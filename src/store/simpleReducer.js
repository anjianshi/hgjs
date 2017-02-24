/*
有时候我们需要利用 Redux 实现一些功能，但又不想完全按照 Redux 的 reducer / actions 流程来安排代码，此时就可以使用这个工具提供的 reducer。

我们可以利用上的功能：
- Redux 将 state 抽离到 component 之外，因此对 HMR 比较友好，reload 时不会丢失 state
- 我们希望将业务逻辑代码放到 React component 外时，可以使用 Redux，把 state 存到 Redux 里，然后利用 react-redux 以在 state 有变动时重新渲染 component
- 有时我们的 component 结构可能有多个层级，照 React 的默认模式，需要把 state 和操作函数一级一级地从上向下传递，
  而通过 Redux 及 react-redux，可以方便、可靠地在任意一级里取得它所需的数据和操作函数。

我们可以考虑不要的东西：
不再遵守 "action creator 执行非 pure 的操作" -> "触发 action" -> "reducer 执行 pure 的 state 更新操作" 这样繁琐的流程。
这一模式强制性地把更新操作拆分到了两个地方，每一个操作都要分别写在两处，还要既定义一个 function，又定义一个 constant（action type），比较麻烦。
其实在很多情况下，完全可以把对 state 的更新就放到和业务操作代码一起。

此 reducer 的使用方式：
此 reducer 的作用就是让你能利用上 Redux 带来的便利，又不用非得遵照 reducer / action 的模式。
具体使用办法就是建立一个这种 reducer 的实例，然后挂载到 redux store 上，此 reducer 只有

此工具需要搭配 reducerHost 使用。


= API
registerSimpleReducer(host, path, initialState):  simpleReducerNode

simpleReducerNode:
    getState()
    setState()
*/

// { updates }
const SET_STATE_ACTION = 'SET_STATE'

export function registerSimpleReducer(host, path, initialState) {
    function simpleReducer(state=initialState, action) {
        // 发起 action 时，允许在 UPDATE_STATE_ACTION 后附加任意内容，以对此次更新进行说明
        if(action.type.startsWith(SET_STATE_ACTION)) {
            state = {...state, ...action.updates}
        }
        return state
    }

    const { getState, dispatch } = host.registerReducer(path, simpleReducer)

    // setState(updates)
    // setState(describe, updates)
    function setState(describe, updates) {
        if(!updates) {
            updates = describe
            describe = null
        }
        const actionType = describe ? SET_STATE_ACTION + '/' + describe : SET_STATE_ACTION
        dispatch({ type: actionType, updates })
    }

    return {
        setState,
        getState,
    }
}
