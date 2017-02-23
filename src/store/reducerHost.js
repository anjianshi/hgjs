/*
redux 默认要求在创建 store 时就把所有 reducer 都定义好，
通过此工具，可以解决这个限制，允许在 store 创建完成后再注册 reducer。
这样我们就可以实现：
1. reducer 的按需加载。
不再像之前那样必须在创建 store 时把所有 reducer 都引入进来；各个模块可以在自己被引用到时，才对自己的 reducer 进行注册。
也就是说，只有被用到了的 reducer 会被注册到 store 中。这样一方面可以减小文件体积；另一方面，每次 dispatch() 时，store 可以少调用几个用不上的 reducer。

2. 各个子模块不用再关心自己被挂载到 store 的什么地方。
现在各子模块通过 reducerNode 而不是 redux store 提供的 getState() 函数来获取自己的 state，这样就无需知道自身被挂载到什么地方。
尤其是各类公共组件，它们不用再要求使用者在使用它们时非得把它们挂载到某个固定的节点上，或是要求在挂载完成后将实际的挂载点告诉它们。


reducerHost 的使用方式:
1. 在创建 redux store 时，把 reducerHost 自身的 rootReducer 包含进去。
2. 调用 reducerHost.bindStore()，把 store 对象及 reducerHost 的 rootReducer 在其中的挂载点信息传给它。
3. 向 reducerHost 里注册 reducer（这一步可以在任意时刻进行，在把 host 绑定到 store 之前和之后都行）

reducerHost 也可以作为一个缓存站，在向其内注册了若干 reducer 后，并不真的将它绑定到 store 上，
而是把它 link 到另一个 host 上（这样这个 host 上的 reducer 就会被转移过去），再把那个 host 绑定到 store 上。
这在我们写工具类库时尤其有用：
工具类库不知道使用者的 store 或 reducerHost 定义在哪个文件上，因此它没法主动调用那个 store / host 去注册自己的 reducer。
为了解决这个问题，它就要提供一个接口，让使用者把 store / host 传递给它。
这很麻烦，而且如果有多个 reducer，就要提供多个接口，或是另想办法实现统一注册 reducer。
而通过 reducerHost 的 link 功能，我们可以在类库内建立一个 host，所有 reducer 都注册到它上面，
虽然类库工具获取不到使用者建立的 host，但使用者却能直接获取到类库里建立并公开出来的 host，
只要使用者把这个 host 给 link 到自己建立的 host 上，类库里的各 reducer 就能正常运行了。

reducerHost link 的具体规则：
. 一个 host link 到另一个 host 上时，它的 reducer 都会转移到那个 host 上去，后续向这个 host 注册的 reducer 也会被注册到那个 host 上。
. link 完成后不能改变或取消
. link 了另一个 host 的 host，它自身也可以继续被 link 到另一个 host 上。
. 一个 host 可以 link 多个其他 host；但不能被多个 host 所 link。
. 一个 host 在 link 到其他 host 上后，就不能再 bind store 了；同样地，已经 bind store 的 host，就不能再被 link 到其他 host 上。


= API
makeReducerHost(): reducerHost
    建立一个 reducer host。

reducerHost:
    id,                 一个 redux store 下允许绑定多个 reducerHost（虽然理应没有任何情况需要这样做），
                        这是为每个 host 生成的随机 ID，仅作调试用途

    rootReducer,
        用来挂载到 redux store 里，通过它来统一管理 host 下所有 reducer 的 state

    bindStore(store, mountPoint),
        将 rootReducer 的挂载情况告诉此 host。
        mountPoint 应是一个数组，例如挂载位置是 { a: { b: { c: rootReducer } } }， mountPoint 就应该是 ['a', 'b', 'c']

    link(otherHost),
        把目标 host link 到此 host 上

    registerReducer(key, reducer): reducerNode
        向 reducerHost 内注册一个 reducer。
        key 在整个 app 内不能重复。

reduerNode:
    key,                此 reducer 的 key，一般用不到。
    getState(),         获得此 reducer 的 state
    dispatch(action)    向此 reducer 传递一个 action，此 action 只有当前 reducer 会接收到。
                        若要传递一个能被所有 reducer 接收到的 action，需使用 redux store 提供的 dispatch 函数


= reducer key 规范

格式： {type}.{blongs...}.{name}

例如一个 Form component，它的 key 可以是 com.form
App 里某个页面的某个 component 的 key，可以是 view.goods.detail.price

这样设计可以尽可能避免 key 发生重复


= action type 要求
基于内部实现的原因，action type 中不应出现 '::' 字样。

传递能被所有 reducer 接收到的 action 时，action type 的设置一定要尽可能具体一点，不要太宽泛。
例如设置成： AUTH/SET_USER_NAME， 而不是 set_name，不然容易导致本不应处理它的 reducer 误将它当作传给自己的 action 而给处理了。

action type 应设置成全大写，这样就能和 reducer host 发起的 action 的 key 部分保持区别
*/
import { get as lodashGet } from 'lodash'


const ACTION_SEP = '::'

// { id: hostId, key: reducerKey, state: reducerState }
const INIT_REDUCER_STATE_ACTION = 'REDUCER_HOST/INIT_REDUCER_STATE'

let nextId = 1

export function makeReducerHost() {
    const id = nextId++

    // key => reducer
    // 之所以用 map，是因为它可以记录顺序，这样先注册的 reducer 就能先被调用
    let reducers = new Map()

    let self    // eslint-disable-line prefer-const

    function getInitialState(reducer) {
        return reducer(undefined, { type: 'REDUCER_HOST/GET_INITIAL_STATE' })
    }

    // ------------------------------------------------

    function rootReducer(state, action) {
        if(!state) {
            // 若 bind store 时 host 里已经注册了 reducer，需要在此初始化它们的 state
            state = {}  // { key: state, ... }
            for(const [key, reducer] of reducers.entries()) {
                state[key] = getInitialState(reducer)
            }
        }

        if(action.type === INIT_REDUCER_STATE_ACTION && action.id === id) {
            state = {...state, [action.key]: action.state }
        } else if(action.type.indexOf(ACTION_SEP) !== -1) {
            const [key, type] = action.type.split(ACTION_SEP)
            // 因为目前允许一个 store 里存在多个 reducerHost，若 reducer 没有找到，可能是因为它被注册到了其他 host 里
            if(reducers.has(key)) {
                const reducer = reducers.get(key)
                const reducerState = state[key]
                const reducerAction = {...action, type}
                state = { ...state, [key]: reducer(reducerState, reducerAction) }
            }
        } else {
            state = {...state}
            for(const [key, reducer] of reducers.entries()) {
                state[key] = reducer(state[key], action)
            }
        }
        return state
    }

    function getRootReducer() {
        checkAllowStore()
        return rootReducer
    }

    let store, mountPoint
    function bindStore(_store, _mountPoint) {
        checkAllowStore()
        store = _store
        mountPoint = _mountPoint
    }

    function checkAllowStore() {
        if(belongsHost) {
            throw new Error(`此 reducerHost（id=${id}）已 link 到其他 host 上，不能再进行 store 相关操作`)
        }
    }

    // ------------------------------------------------

    function link(targetHost) {
        if(targetHost === self) throw new Error('reducerHost 不能 link 自己')
        targetHost._linkTo(self)
    }

    let belongsHost
    // host 被 link 到另一个 host 上时，此方法会被那个 host 调用
    function linkTo(_blongsHost) {
        if(belongsHost) throw new Error(`此 reducerHost（id=${id}）已经 link 到一个 host 上，不能再 link 到其他 host 上`)
        if(store) throw new Error(`此 reducerHost（id=${id}）已绑定 store，不能再 link 到其他 host 上`)

        belongsHost = _blongsHost

        for(const [key, reducer] of reducers.entries()) {
            belongsHost.registerReducer(key, reducer)
        }
        reducers = null
    }

    // ------------------------------------------------

    function getStore() {
        return belongsHost ? belongsHost._getStore() : store
    }

    function getMountPoint() {
        return belongsHost ? belongsHost._getMountPoint() : mountPoint
    }

    function registerReducer(key, reducer) {
        if(belongsHost) {
            return belongsHost.registerReducer(key, reducer)
        } else {
            reducers.set(key, reducer)

            if(store) {
                const state = get(store.getState(), mountPoint)
                // 若 state 中已经有了此 key（例如因为使用者实现了 state 持久化，以前的 state 被留了下来），则不再进行填充
                if(!(key in state)) {
                    const reducerState = getInitialState(reducer)
                    store.dispatch({ type: INIT_REDUCER_STATE_ACTION, id, key, state: reducerState })
                }
            }
        }

        function getState() {
            return get(getStore().getState(), [...getMountPoint(), key])
        }

        function dispatch(action) {
            if(action.type.indexOf(ACTION_SEP) !== -1) throw new Error(`action type 里不能带有 "${ACTION_SEP}" 字符`)
            return getStore().dispatch({...action, type: key + ACTION_SEP + action.type})
        }

        return {
            key, getState, dispatch
        }
    }

    self = {
        id,
        get rootReducer() { return getRootReducer() },
        bindStore,
        _getStore: getStore,
        _getMountPoint: getMountPoint,

        link,
        _linkTo: linkTo,

        registerReducer
    }
    return self
}

// lodash.get() 在 path 为空时，会返回 undefined
// 而对于 reducerHost，当使用者把它挂载为 store 的根 reducer 时，它的 mountPoint 确实是为空的，但此时对其获取 state，不应返回 undefined，而应返回整个 state
function get(obj, path) {
    if(!path || !path.length) return obj
    return lodashGet(obj, path)
}
