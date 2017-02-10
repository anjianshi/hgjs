/*
action 触发方式：
dispatch(ACTION_PREFIX + key, { updates, replace })

key 是要更新的 component 的 state 在 store 里挂载的节点名。
为便于查看日志，这里设计成把 key 附加到 ACTION_PREFIX 后面，而不是通过 action object 来传递。
此外，还允许在 key 后面再额外附加其他信息（ACTION_PREFIX + key + '/extra_xxx'）
这些信息也会为查看日志带来方便，它们不会被真的使用。

updates: 要更新的内容
replace: 若为 true，会用 updates 整个替换原来的 state
*/
const ACTION_PREFIX = 'REDUX_STATE/'

function reduxStateReducer(state={}, action) {
    if(action.type.startsWith(ACTION_PREFIX)) {
        const key = action.type.split('/')[1]
        return {
            ...state,
            [key]: action.replace ? action.updates : {
                ...state[key],
                ...action.updates
            }
        }
    }
    return state
}

export let reducerNode

export function bindStore(store) {
    reducerNode = store.registerReducer('reduxState', reduxStateReducer)
}

export function getState(key) {
    return reducerNode.getState()[key]
}

export function setState(key, updates, by=null, replace=false) {
    const action = ACTION_PREFIX + key + (by ? '/' + by : '')
    reducerNode.dispatch({ type: action, updates, replace })
}
