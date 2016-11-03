/*
创建能够动态添加 reducer 的 store

dynamic store 的结构类似文件系统，由文件（reducer）和文件夹（reducer host）组成。
每个 reducer host 下，可以注册若干个子 reducer 和子 reducer host。
store 作为整个结构的顶端，它本身也一个 reducer host。

dynamic store 的主要有两个作用：
1. 实现 reducer 的按需加载。
在 dynamic store 中，reducer 的注册变成了分布式的。
不再像之前那样必须在创建 store 时把所有 reducer 都引入进来；各个模块可以在自己被引用到时，才对自己的 reducer 进行注册。
也就是说，只有被用到了的 reducer 会被注册到 store 中。这样一方面可以减小文件体积；另一方面，每次 dispatch() 时，store 可以少调用几个用不上的 reducer。

2. 各个子模块不用再关心自己被挂载到 store 的什么地方。
现在每个 reducer 的挂载点信息都由 store / host 来维护，各个子模块自身无需知道自己被挂载到什么地方。
当它需要获取自身的 state 时，直接调用 reducerHost 以及 reducerNode 提供的 getState() 方法即可。
尤其是像 common/lib/ 或 common/components/ 下的各个组件，它们不用再要求所有前端模块都将它们定义在 store 中的同一个节点上，或是在挂载完成后将实际的挂载点告诉它们。
这些信息都改成了在一级一级的 reducer host 内部流动，对终端 reducer 来说，是透明的。
（原来获取 state 方式并没有因此而无效，依然可以正常使用）

动态更新 store 中的 reducer 的方法参考了：http://stackoverflow.com/a/33044701/2815178


# API
createDynamicStore(initState, enhancer): store（reducerHost）
    创建一个能够动态添加 reducer 的 store。
    和 redux 的 createStore() 使用方法一样，但不用指定 rootReducer（所有 reducer 均在 store 创建完成后，通过 store 实例提供的接口进行添加）
    返回的 store instance 在 redux store 的基础上增加了 reducerHost 的接口

createReducerHost(): host
    创建一个 host 实例，用来在之后注册到 dynamic store 或其他 host 中。


reducerHost 接口：
    registerReducer(name, reducer): reducerNode
        将一个 reducer 注册到 host 的指定节点

    registerHost(name, host=null): reducerHost
        将一个子 reducer host 注册到 host 的指定节点。
        如果没有提供 host，此方法会自动创建并注册一个空的 host，并将其返回。

    getState(): state
        返回此 host 的当前 state

    dispatch()
        store.dispatch 的快捷方式

reducerNode 接口：
    getState(): state
        返回此 reducer 的当前 state

    dispatch()
        store.dispatch 的快捷方式



# 范例
const numberReducer = (state=1, action) => action.type === "add" ? state + 1 : state
// const moneyReducer = xxx, messageReducer = xxx, timeReducer = xxx

const store = createDynamicStore()

store.registerReducer('money', moneyReducer)

const host1 = makeReducerHost()
host1.registerReducer('time', timeReducer)   // 可以先在 host 里注册子 reducer / host，然后再把 host 注册到上级 store / host 中
store.registerHost('host1', host1)

const host2 = store.registerReducerHost('host2')  // 由 store 生成一个空 host 并直接完成注册
host2.registerReducer('message', messageReducer)
host2.registerReducer('number', numberReducer)

以上代码得到的 store 结构等同于：
createStore(combineReducers({
    money: moneyReducer,
    host1: combineReducers({
        number: numberReducer
    }),
    host2: combineReducers({
        message: messageReducer,
        time: timeReducer
    })
}))

host1.dispatch({type: "add})
store.getState()    // 返回：{money: xxx, host1: { number: 2 }, host2: { message: xxx, time: xxx }}
host1.getState()    // 返回：{number: 2}
node.getState()     // 返回：2


# 注释
现在 reducerHost 通过返回一个 getState() 函数来让各子节点能够取得自己的 state
这样的好处是方便，但缺点是各子节点使用 react-redux 的 connect() 函数时，没法从接收到的 state 对象提取出自己的 state，只能也是调用 getState()。
这样的调用应该不至于影响性能，但不是很直观。

*/


import { createStore } from 'redux'

function emptyReducer(state={}) {
    return state
}


export function createDynamicStore(...args) {
    const store = createStore(emptyReducer, ...args)

    const rootReducerHost = createReducerHost()
    rootReducerHost.bind(
        newReducer => store.replaceReducer(newReducer),
        store.getState,
        store.dispatch,
    )

    return {
        ...store,
        ...rootReducerHost
    }
}


export function createReducerHost() {
    let reducers = null         // 在尚未注册任何 child 的情况下，此值为 null；第一个 child 注册进来时，将其转换成 object

    /*
        未与上级绑定时，为 null；绑定后，为 object
        {
            onUpdate,   // 当 reducers 有更新时，通过此回调，将最新生成的 reducer 传给上级
            getState,   // 返回此 host 对应的 state
            dispatch    // 实际就是 store.dispatch。有了它，业务代码中要调用 dispatch() 时就不用通过 store 去取了，直接就近通过此对象来取即可。
        }
     */
    let bound = null

    function getState() {
        if(!bound) throw new Error('此 reducerHost 尚未与上级绑定，不能调用此方法')
        return bound.getState()
    }

    function dispatch(...args) {
        if(!bound) throw new Error('此 reducerHost 尚未与上级绑定，不能调用此方法')
        return bound.dispatch(...args)
    }

    function onUpdate() {
        if(bound) {
            bound.onUpdate(reducers ? combineReducers(reducers) : emptyReducer)
        }
    }

    function registerReducer(name, reducer, allowReplace=false) {
        if(!(arguments.length >= 2 && typeof name === 'string')) throw new Error('registerReducer: 参数数量或格式不正确')
        if(!allowReplace && reducers && (name in reducers)) throw new Error(`reducer '${name}' 已存在，不能再次注册`)

        reducers = {...reducers, [name]: reducer}
        onUpdate()
        return {
            getState: () => getState()[name],
            dispatch,
        }
    }

    function registerHost(name, host=null) {
        if(typeof name !== 'string') throw new Error('registerHost: 参数格式不正确')
        if(reducers && (name in reducers)) throw new Error(`reducer node / host '${name}' 已存在，不能再次注册`)

        if(!host) {
            host = createReducerHost()
        }
        host.bind(
            newReducer => registerReducer(name, newReducer, true),
            () => getState()[name],
            dispatch)
        return host
    }

    // 将当前 host 与上级进行绑定
    function bind(_onUpdate, _getState, _dispatch) {
        bound = { onUpdate: _onUpdate, getState: _getState, dispatch: _dispatch }
        onUpdate()
    }

    return {
        getState,
        dispatch,
        registerReducer,
        registerHost,
        bind,               // 只在内部使用
    }
}


/*
取自： https://github.com/reactjs/redux/blob/master/src/combineReducers.js

在实现了 state 持久化的 app 中，原版的 combineReducers 不能适应动态添加 reducer 的情况。
因为会出现 state 中已经有了某个 key，但对应的 reducer 却不存在的情况（state 是在创建 store 时就指定了的，但 reducer 要在之后才添加进来）,
在这种情况下，它会抛出 warning。
因此，这个自定义的版本去掉了这个 warning。
详见： http://stackoverflow.com/questions/34095804/replacereducer-causing-unexpected-key-error
*/
function combineReducers(reducers) {
    const reducerKeys = Object.keys(reducers)

    return function combination(state = {}, action) {
        let hasChanged = false
        // 这里和原版 combineReducers 的行为不同。
        // 原版的 nextState 一开始是空 object，
        // 在实现了 state 持久化的 app 中，有可能某个 state 节点有 state，但是对应的 reducer 尚未绑定上来，
        // 这种情况下，原版的 combineReducers 会导致这个 state 节点的 state 丢失。
        // 而现在这里把 state 的 shallow copy 作为 nextState，就避免了这个情况。
        const nextState = {...state}
        for(let i = 0; i < reducerKeys.length; i++) {
            const key = reducerKeys[i]
            const reducer = reducers[key]
            const previousStateForKey = state[key]
            const nextStateForKey = reducer(previousStateForKey, action)
            if(typeof nextStateForKey === 'undefined') {
                var errorMessage = getUndefinedStateErrorMessage(key, action)
                throw new Error(errorMessage)
            }
            nextState[key] = nextStateForKey
            hasChanged = hasChanged || nextStateForKey !== previousStateForKey
        }
        return hasChanged ? nextState : state
    }
}

function getUndefinedStateErrorMessage(key, action) {
    const actionType = action && action.type
    const actionName = actionType && `"${actionType.toString()}"` || 'an action'

    return (
        `Given action ${actionName}, reducer "${key}" returned undefined. ` +
        `To ignore an action, you must explicitly return the previous state.`
    )
}
