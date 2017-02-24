/*
redux 默认要求在创建 store 时就把所有 reducer 都定义好，
通过此工具，可以解决这个限制，允许在创建 store 后注册 reducer。
这样我们就可以实现：
1. reducer 的按需加载。
不再像之前那样必须在创建 store 时把所有 reducer 都引入进来；各个模块可以在自己被引用到时，才对自己的 reducer 进行注册。
也就是说，只有被用到了的 reducer 会被注册到 store 中。这样一方面可以减小文件体积；另一方面，每次 dispatch() 时，store 可以少调用几个用不上的 reducer。

2. 各个子模块不用再关心自己被挂载到 store 的什么地方。
现在各子模块通过 reducerNode 而不是 redux store 提供的 getState() 函数来获取自己的 state，这样就无需知道自身被挂载到什么地方。
尤其是各类公共组件，它们不用再要求使用者在使用它们时非得把它们挂载到某个固定的节点上，或是要求在挂载完成后将实际的挂载点告诉它们。


= 使用方式
1. 创建 reducer host
2. 创建 redux store 时，把 reducer host 的 rootReducer 包含进去（可以挂载到任意位置，包括挂载为 store 的根 reducer）
3. 调用 reducerHost.bindStore()，把 store 对象和 reducer host 所处的挂载点传给它。
4. 向 reducer host 里注册 reducer（这一步实际上可以在任意时刻进行，包括在建立 store 之前）

reducer host 也可以作为一个缓存站，不将它绑定到 store 上，而是把它 link 到另一个 host 上，
这样这个 host 上的 reducer 就会被转移过去 —— 然后再把那个 host 绑定到 store 上。

这在我们写工具类库时尤其有用：
工具类库不知道使用者的 store 或 reducer host 定义在哪里，它没法主动调用那个 store / host 去注册自己的 reducer。
于是它只好提供一个接口，让使用者把 store / host 传递给它。
这很麻烦，而且如果有多个 reducer，就要提供多个这种接口，或是另想办法实现统一注册 reducer。
而通过 reducer host 的 link 功能，我们可以在类库内建立一个 host，所有 reducer 都注册到它上面，
虽然类库工具获取不到使用者建立的 host，但使用者却能获取到类库里的 host，
只要使用者把这个 host 给 link 到自己建立的 host 上，类库里的各 reducer 就能正常运行了。

reducerHost link 的具体规则：
(a link to b，a 的 reducer 转移到 b 上，这里我们称 a 为下级 host、b 为上级 host)
. 执行 link 时，下级 host 的 reducer 会转移到上级 host 中去；后续向下级 host 注册的 reducer 也会被注册到上级 host 上。
. link 完成后不能改变或取消
. 允许 a link to b -> b link to c，最终 a 和 b 上的 reducer 都会被转移到 c 上。
. 一个 host 可以有多个下级 host；但只能有一个上级 host。
. 一个 host 在 link 到其他 host 上后，就不能再 bind store 了；同样地，已经 bind store 的 host，就不能再被 link 到其他 host 上。


= reducer path
注册 reducer 时，需要指定一个 path，代表这个 reducer 的 state 应被挂载到 host 下的什么位置。
它的形式是一个以 '.' 分隔的字符串，例如 'a.b.c'。

path 在整个 reducer host 里不能重复；也不允许出现一个 path 是另一个 path 的上级的情况（path1='a.b', path2='a.b.c'）

建议以 `{type}.{blongs...}.{name}` 的格式来设置 path：
例如一个 form component 的 path 可以设置成 com.form，
而 app 里商品详情页的一个子 component 的 path 可以设置成 view.goodsDetail.price。
这样可以避免产生重复的 path。

在存放 reducer state 时，会将 path 字符串按 '.' 拆分开，把 state 存放在对象结构下。
例如 path 为 'a.b.c'，reducer state 就会这样存放： `{a: {b: {c: reducerState }}}`


= dispatch action
注册 reducer 时，会得到一个 reducerNode 对象，这个对象里有一个 dispatch() 方法，
通过这个方法，我们可以发送一个只有当前 reducer 能接收到的 action，不用对 action type 进行任何特殊处理（例如添加前缀）。
这样，我们就可以对 action type 进行简化，直接使用 type 内容即可。例如： ADD、LOADED，而无需设置成 'GOODS_DETAIL/ADD'

但要注意一件事，因为 reducer 除了能接收到这种专门发送给它的 action，也能接收到其他所有通过 store.dispatch() 发送的公共 action。
因此必须保证公共 action 的 action type 不会和私有的 action type 发生重复，不然 reducer 就会对本不属于它的 action 进行处理。
可以通过给公共 action 的 type 添加前缀来解决这个问题。

一般来说，建议以这样的格式定义 action type：
全大写，若需要分段，用 '/' 作为分隔符。
例如： 'APP/AUTH/LOGIN'


= API
makeReducerHost(): reducerHost
    建立一个 reducer host。

reducerHost:
    id,                 一个 redux store 下允许绑定多个 reducerHost（虽然理应没有任何情况需要这样做），
                        这是为每个 host 生成的随机 ID，仅作调试用途

    rootReducer,
        用来挂载到 redux store 里，通过它来统一管理 host 下所有 reducer 的 state

    bindStore(store, mountPoint=null),
        将 rootReducer 的挂载情况告诉此 host。
        mountPoint 应为一个以 '.' 分隔的字符串，例如挂载位置是 { a: { b: { c: rootReducer } } }， mountPoint 就应该是 'a.b.c'
        若将 rootReducer 挂载为 store 的根 reducer，则 mountPoint 应为空。

    link(otherHost),
        把目标 host link 到此 host 上

    registerReducer(path, reducer): reducerNode
        向 reducerHost 内注册一个 reducer。

reduerNode:
    path,               此 reducer 的 path
    getState(),         获得此 reducer 的 state
    dispatch(action)    向此 reducer 传递一个只有它能接收到的 action。
                        若要传递一个能被所有 reducer 接收到的 action，应使用 redux store 提供的 dispatch 函数

*/
import { has, get, omit } from 'lodash'
import { immuSet } from 'lang'


let nextId = 1

export function makeReducerHost() {
    const id = nextId++

    // path string => reducer
    // 之所以用 map，是因为它可以记录顺序，这样先注册的 reducer 就能先被调用
    let reducers = new Map()

    let self    // eslint-disable-line prefer-const

    function getInitialState(reducer) {
        return reducer(undefined, { type: '' })
    }

    // ------------------------------------------------

    // { path: reducerPath }
    const INIT_STATE_ACTION_PREFIX = `RH/${id}/INIT_STATE/`

    // private action format:
    // { type: PRIVATE_ACTION_PREFIX/reducerPath/realActionType, _rh_hostId, _rh_path, _rh_type, ...actionContent }
    // type 仅用来向 redux-logger 提供友好的输出信息，实际要用到的 action 信息通过其他属性传递
    const PRIVATE_ACTION_PREFIX = `RHPA/`

    let rootReducerInited = false
    function rootReducer(state, action) {
        if(!state) state = {}

        // 不能根据 state 是否有值来判断 rootReducer 是否是第一次被调用
        // 因为如果使用者实现了 state 持久化，那么一上来就是有值的。
        if(!rootReducerInited) {
            // 在 rootReducer 初始化时，填充当前已注册的 reducer 的 state。
            // 即使 rootReducer 的 state 在此时已经有值（即实现了 state 持久化），也要挨个 reducer 检查一下，因为当前可能会有之前没注册过的 reducer 出现。
            for(let [path, reducer] of reducers.entries()) {    // eslint-disable-line prefer-const
                path = path.split('.')
                if(!has(state, path)) {
                    state = immuSet(state, path, getInitialState(reducer))
                }
            }
            rootReducerInited = true
        }

        if(action.type.startsWith(INIT_STATE_ACTION_PREFIX)) {
            const path = action.path.split('.')
            if(!has(state, path)) {
                const reducer = reducers.get(action.path)
                state = immuSet(state, path, getInitialState(reducer))
            }
        } else if(action.type.startsWith(PRIVATE_ACTION_PREFIX) && action._rh_hostId === id) {
            const reducer = reducers.get(action._rh_path)
            if(!reducer) throw new Error(`reducerHost id=${id} 里找不到指定 reducer path=${action._rh_path}，private action 处理失败`)

            const path = action._rh_path.split('.')
            const reducerState = get(state, path)
            const realAction = {...omit(action, 'type', '_rh_hostId', '_rh_path', '_rh_type'), type: action._rh_type}
            state = immuSet(state, path, reducer(reducerState, realAction))
        } else {
            for(const [path, reducer] of reducers.entries()) {
                const splitPath = path.split('.')
                state = immuSet(state, splitPath, reducer(get(state, splitPath), action))
            }
        }

        return state
    }

    function getRootReducer() {
        checkAllowStore()
        return rootReducer
    }

    let store, mountPoint
    function bindStore(_store, _mountPoint=null) {
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
        const mountPointStr = belongsHost ? belongsHost._getMountPoint() : mountPoint
        return mountPointStr ? mountPointStr.split('.') : []
    }

    function registerReducer(path, reducer) {
        if(belongsHost) {
            return belongsHost.registerReducer(path, reducer)
        } else {
            for(const otherPath of reducers.keys()) {
                // 不允许出现一个 path 是另一个 path 的上级的情况（path1='a.b', path2='a.b.c'）
                // 此检查也同时保证了不会有同 path 的 reducer
                if(otherPath.startsWith(path) || path.startsWith(otherPath)) {
                    throw new Error(`reducerHost: reducer path 冲突 ${path}、${otherPath}`)
                }
            }

            reducers.set(path, reducer)
            if(store) {
                store.dispatch({ type: INIT_STATE_ACTION_PREFIX + path, path })
            }
        }

        function getState() {
            return get(getStore().getState(), [...getMountPoint(), ...path.split('.')])
        }

        function dispatch(rawAction) {
            const action = {
                ...rawAction,
                type: PRIVATE_ACTION_PREFIX + path + '/' + rawAction.type,
                _rh_hostId: id,
                _rh_path: path,
                _rh_type: rawAction.type
            }
            return getStore().dispatch(action)
        }

        return {
            path, getState, dispatch
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
