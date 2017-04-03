// 此工具的介绍和使用方法见 doc/commonData.adoc

/*
在应用中，经常会有多个 component / 页面需要用到同一份数据的情况，
通过此工具，可以实现对这些数据的“一次加载、多处使用”：一份数据只要被载入过一次，后面其他 component 或页面再使用它，就无需再次加载了。
节省了加载时间。

此工具需要搭配 reducerHost 使用。

使用方法：
先调用 init() 函数，进行初始化，并定义好所有支持载入的数据类型，
然后在需要使用这些数据的地方，通过
*/

import { registerSimpleReducer } from 'store'
import invariant from 'invariant'

/*
想法：其实应该不用再提供 get 和 pickAs 等函数，由使用者自行从 state 里提取即可。
因为挂载点是使用者自己确定的。
*/


let getState, setState
export { getState }

// { name: loader, ...}
// loader 负责载入数据，其应返回一个 bluebird Promise，并最终解析出获取到的数据
let loaders

// { name: promise, ...}
const promises = {}


export function init(host, path, _loaders) {
    const initialState = {
        // name: data || null

        loading: {
            // name: bool
        },
    }
    for(const name of Object.keys(_loaders)) {
        initialState[name] = null
        initialState.loading[name] = false
    }

    const node = registerSimpleReducer(host, path, initialState)
    getState = node.getState
    setState = node.setState
    loaders = _loaders
}


// 声明当前代码需要某项公共数据，如果指定的数据尚未载入，则会立刻进行载入。
// 此函数会返回一个包含目标数据的 Promise
export function need(name) {
    const state = getState()
    if(state[name] !== null) {
        return Promise.resolve(state[name])
    } else if(state.loading[name]) {
        // 如果某项数据已经处于载入中的状态了（例如有另一个 component 预先触发了对它的载入），不会再重复进行载入。
        return promises[name]
    } else {
        return load(name)
    }
}

// 加载某项数据。**如果数据已经存在，会将其清除并重新加载**
// 也就是每次调用此函数，都会重新载入目标数据。
// 此函数返回一个 Promise，包含最终载入进来的数据
export function load(name) {
    invariant(name in loaders, `commonData "${name}" 不存在`)
    return loading(name, loaders[name]())
}

// 给出一个最终会返回指定数据的 promise，在它被完成前，此函数会让指定数据项处于“载入中...”状态，并在它完成并返回目标数据后，将目标数据写入公共空间。
export function loading(name, promise) {
    // 若此数据正在载入中，将之前的请求取消掉，重新发起。
    // 因为此次调用的上下文可能已经和上次不一样了，再次调用得到的数据会和之前的不同
    //（例如之前是未登录状态下、现在是登录状态下发起的请求）
    const state = getState()
    if(state.loading[name]) promises[name].cancel()

    setState(`${name} loading`, { loading: {...state.loading, [name]: true} })

    promises[name] = promise
    promise.then(data => loaded(name, data))
    promise.finally(() => {
        delete promises[name]
        setState({ loading: {...getState().loading, [name]: false} })
    })
    return promise
}

// 将指定数据值写入到某项数据中
// 使用者如有需要，可以不经过 loading 阶段，直接调用此函数写入数据
export function loaded(name, data) {
    setState(`${name} loaded`, { [name]: data })
}

export function clear(name) {
    if(name in promises) promises[name].cancel()
    setState(`${name} cleared`, { [name]: null })
}
