/*
此工具的介绍和使用方法见 doc/commonData.adoc
此工具需要搭配 reducerHost 使用
*/

import React from 'react'
import { connect } from 'react-redux'
import invariant from 'invariant'
import hoistNonReactStatic from 'hoist-non-react-statics'
import { Promise } from 'promise'
import { pickAs } from 'lang'
import { registerSimpleReducer } from 'store'



// ========== init ==========

let loaders, failedHandler

/*
初始化 commonData 组件

loaders
    定义当前应用支持加载的公共数据项
    格式：{ name: loader, ... }

    每个 loader 是一个函数，调用它返回一个能够最终解析出此项数据的 promise（称之为 loaderPromise）
    若数据加载失败，loaderPromise 应以 reject 的形式结束，以触发此工具的重新加载机制。

failedHandler
    每当有数据项加载失败时（loaderPromise reject），会调用此函数。

    在数据载入失败时，不应该立刻尝试重新载入。可能导致失败的原因有网络没开启、信号不好或服务器故障，在故障原因没有消失的情况下重新载入，只能是再次导致失败。
    因此这里把对时机的控制权交给使用者（用户），让他在他认为合适的时候触发重新加载。

    此函数应返回一个 promise（称之为 failedHandlingPromise），当使用者（用户）觉得可以重新载入时，就让这个 promise resolve，然后此工具就会开始重新载入。

    在触发此回调后，若在用户确认重新加载前，又有其他数据加载失败，并不会再次触发此回调，
    而是会把这些失败的数据项攒在一起，等用户确认后统一开始重新加载。

    failedHandlingPromise 不应 reject 和 cancel。
*/
function init(reducerHost, reducerPath, _loaders, _failedHandler) {
    initState(reducerHost, reducerPath, Object.keys(_loaders))
    loaders = _loaders
    failedHandler = _failedHandler
}



// ========== state ==========

let getState, setState

function initState(host, path, dataKeys) {
    const initialState = {
        // name: data || null

        loading: {
            // name: bool
        },
    }
    for(const name of dataKeys) {
        initialState[name] = null
        initialState.loading[name] = false
    }

    const node = registerSimpleReducer(host, path, initialState)
    getState = node.getState
    setState = node.setState
}



// ========== loading ==========

const controllingPromises = {} // { name: promise }


// 声明需要使用某项数据。如果此数据尚未载入，会触发载入行为。
// 此函数会返回一个能解析出目标数据的 promise
function need(name) {
    const data = getState()[name]
    return data ? Promise.resolve(data) : load(name)
}


/*
执行数据载入，并返回一个会在载入完成时 resolve 的 promise（称之为 clientPromise，详见下面说明）
若数据已存在，则会重新载入（新数据载入完成前，老数据依然存在）

= 数据载入流程
开始载入数据时，会生成一个 controllingPromise，它的生命周期完全对应于一次从开始到结束的载入行为。
controllingPromise 会调用 loader 来取得 loaderPromise，并监视 loaderPromise 的运行。
若 loaderPromise 成功取得数据，则 controllingPromise 也 resolve，完成加载；
若 loaderPromise 加载失败，则启动失败处理程序，等待用户触发重新加载，然后重新取得 loaderPromise 并重新加载。
（但并不会重新建立一个 controllingPromise，而是会依然保持此 promise 的运行，直到数据最终加载成功）
controllingPromise 不会 reject；除非数据项被 clear，否则也不会被 cancel（也就是说，除非用户主动想要停止载入，否则一次载入行为一旦开始就不会因为任何原因被终止）

若调用此函数时目标数据已经在载入过程中了（即已经有了一个正在运行的 controllingPromise），并不会重启加载行为，而是会继续沿用当前的 controllingPromise。

此函数会返回一个将 controllingPromise 包裹起来而成的 clientPromise；
这样当使用者不再需要此数据时，可以随意地将 clientPromise cancel 掉，而不会导致加载行为也终止。
每次取得的 clientPromise 都是独立重新构建的，有多个地方都请求了同一个数据时，其中一个地方 cancel 掉 clientPromise，不会影响其他地方的 clientPromise 的运行。

= loaderPromise 参数
通过指定此参数，可以以指定的 loaderPromise 开始载入流程。
如果当前已经开始载入流程了，那么此参数会被忽略。
另外，此参数只在初次尝试载入时有效；若载入失败并重新开始载入，则还是会使用 loader 返回的 promise。
*/
function load(name, loaderPromise=null) {
    if(!controllingPromises[name]) {
        controllingPromises[name] = new Promise((resolve, reject, onCancel) => {
            setState(`${name} loading`, { loading: {...getState().loading, [name]: true} })

            let cancelled = false
            onCancel(() => {
                cancelled = true
                delete controllingPromises[name]
                setState(`${name} cancelled`, { loading: {...getState().loading, [name]: false} })
            })

            function onResolve(data) {
                // 在 controllingPromises 已被 cancel 的情况下，不再响应下级 loaderPromise 的 resolve 事件
                if(cancelled) return

                delete controllingPromises[name]

                setState(`${name} loaded`, {
                    [name]: data,
                    loading: {...getState().loading, [name]: false}
                })

                resolve(data)
            }

            function waitingLoaderPromise(loaderPromise) {
                loaderPromise.then(
                    data => onResolve(data),
                    () => handlingFailed(
                        () => waitingLoaderPromise(loaders[name]())
                    )
                )
            }

            waitingLoaderPromise(loaderPromise || loaders[name]())
        })
    }

    return makeClientPromise(controllingPromises[name])
}

function makeClientPromise(controllingPromise) {
    return new Promise(resolve => controllingPromise.then(data => resolve(data)))
}

// 清除指定数据项；如果数据项有正在进行的加载行为，还会将此行为终止。
// 注意：终止加载行为将使所有正在监听此数据加载过程的地方永远得不到结果。一定要确定此数据真的不再被需要了才调用此函数。
function clear(name) {
    if(controllingPromises[name]) controllingPromises[name].cancel()
    setState({ [name]: null })
}


// ========== failed handling ==========

// 等待使用者发起信号重新载入数据的信号的 promise，平常为 null
let handlingPromise = null

let callbacks = [/* callback, callback, ... */]


// 某项数据载入失败时，注册一个回调。
// 当使用者确定可以开始重新载入数据时，依次调用这些回调，告诉它们可以进行重新加载了。
function handlingFailed(callback) {
    callbacks.push(callback)

    if(!handlingPromise) {
        handlingPromise = failedHandler()

        handlingPromise.then(() => {
            // 重置 handlingPromise 和 callback 列表
            handlingPromise = null
            const _callbacks = callbacks
            callbacks = []

            for(const callback of _callbacks) callback()
        })
    }
}



// ========== component helper ==========

/*
item 格式：
{
    data: string,         commonData init() 里定义的 data name
    prop: string,         （可选）此 data 传给 component 时使用的 prop name，默认和 data name 一样
    forceReload: bool     （可选，默认为 false）若指定为 true，则每次使用时都重新加载数据
}
或
string         也可以指定一个字符串作为 data 值，其他各项均使用默认值。

此函数还会在 props 中额外传入一个 onDataLoaded() 方法。
它和 commonData need() / load() 效果类似，都是在指定数据项载入完成时，调用回调，并将数据传给它。
*/
const withData = (...rawItems) => WrappedComponent => {
    const items = new Map()     // dataName => forceReload
    const propAliases = {}      // dataName: propName

    for(const item of rawItems) {
        if(typeof item === 'string') {
            items.set(item, false)
            propAliases[item] = item
        } else {
            items.set(item.data, item.forceReload || false)
            propAliases[item.data] = item.props || item.data
        }
    }

    @connect(() => pickAs(getState(), propAliases))
    class CommonDataWrapper extends React.Component {
        componentWillMount() {
            for(const [dataName, forceReload] of items.entries()) {
                if(forceReload) {
                    load(dataName)
                } else {
                    need(dataName)
                }
            }
        }

        onLoaded(dataName, callback) {
            invariant(items.has(dataName), `onDataLoaded: 数据 ${dataName} 不在 withData 列表中，不应对其设置回调，请检查是否有输入错误`)
            return need(dataName).then(callback)
        }

        render() {
            return <WrappedComponent {...this.props} onDataLoaded={this.onLoaded} />
        }
    }

    return hoistNonReactStatic(CommonDataWrapper, WrappedComponent)
}



export {
    init,
    need,
    load,
    clear,
    withData,
}
