/*
扩展 redux store，使其支持 batchedUpdates，即多次 dispatch()，只触发一次 listener。
其他提供了类似功能的工具： https://github.com/tappleby/redux-batched-subscribe

此函数是一个 redux store enhancer，相关介绍： http://redux.js.org/docs/Glossary.html#store-enhancer

使用范例：
import { createStore, applyMiddleware, compose } from 'redux'

const store = createStore(reducer, compose(
    applyMiddleware(someMiddleware),
    supportBatchedUpdates()
))

store.batchedUpdates(() => {
    // 在此回调内执行的多次 dispatch 只会触发一次 listener
    store.dispatch({ ... })
    store.dispatch({ ... })

    // 允许嵌套调用 store.batchedUpdates()，不过并不会有什么特殊效果，
    // 会在最外层的回调运行完成后触发 listener
    store.batchedUpdates(() => {
        ...
    })
})
*/
export const supportBatchedUpdates = () => (createStore) => (reducer, preloadedState, enhancer) => {
    const store = {...createStore(reducer, preloadedState, enhancer)}
    const origSubscription = store.subscribe

    let inBatchContext = false
    let needCallListeners = false

    function batchedUpdates(callback) {
        // 支持嵌套使用此方法
        if(inBatchContext) callback()

        inBatchContext = true
        // batchedUpdates() 会返回 callback 的返回值
        const returnVal = callback()
        inBatchContext = false

        if(needCallListeners) {
            needCallListeners = false
            for(const listener of listeners) {
                listener()
            }
        }

        return returnVal
    }

    const listeners = new Set()     // 因为在外部获取不到 redux store 的 listener 列表，所以要自己单独记录一份
    function subscribe(listener) {
        listeners.add(listener)

        function wrappedListener() {
            if(!inBatchContext) {
                listener()
            } else {
                needCallListeners = true
            }
        }

        const origUnsubscribe = origSubscription(wrappedListener)

        function unsubscribe() {
            listeners.delete(listener)
            return origUnsubscribe()
        }

        return unsubscribe
    }

    store.batchedUpdates = batchedUpdates
    store.subscribe = subscribe

    return store
}
