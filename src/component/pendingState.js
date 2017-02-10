/*
通过手动维护一个 pendingState 属性，解决执行 setState() 后访问 this.state 不能读取到最新值的问题

React 中的 this.state 代表的是 current state，也就是当前 render() 中使用的 state。
而我们在执行操作时，需要能读取到 pending state。
React 目前没有提供读取 pendingState 的接口（以后有可能提供），因此暂时先手动维护一个 pendingState 来解决此问题。

对此问题的详细讨论：
https://groups.google.com/d/msg/reactjs/R61kPjs-yXE/88npvV3kFr4J
http://www.bennadel.com/blog/2893-setstate-state-mutation-operation-may-be-synchronous-in-reactjs.htm
https://github.com/facebook/react/issues/122
https://www.google.co.jp/webhp?sourceid=chrome-instant&ion=1&espv=2&ie=UTF-8#q=react%20immediate%20setState

// ========================

读取不到最新的 state 是因为 React 有一个 transaction 机制。
它会把多次 setState() 操作合并到一起执行，并且只触发一次 render()。
但要注意，**一定不要让业务操作依赖于这一特性**。

React 并不保证连续的多次 setState() 一定会被合并执行。
在目前的实现里，貌似只有事件回调中的多次 setState() 会被合并，其他情况下，每次 setState() 都会立刻触发更新（并调用 render()）。
包括在事件回调里构建出来的 Promise，因为它会开辟一个独立的事件流，所以在其中连续执行的多次 setState() 也是每次都会立刻触发一次更新。

对于确实希望多次 setState() 可以被合并处理的情况，此 decorator 提供了一个 batchedUpdates() 方法。
它和 ReactDOM 提供的 unstable_batchedUpdates() 类似，但在不支持 DOM 的环境下也能使用。
把一个回调函数传给它，在这个函数内执行的多次 setState() 能够确保被合并处理。
*/
export function pendingState(Component) {
    class WithPendingState extends Component {
        static displayName = Component.displayName || Component.name

        constructor(props) {
            super(props)

            this.pendingState = this.state
            this.inBatchContext = false
            this.stateNeedFlush = false
        }

        // 与 React 原生的此方法相比，不支持 callback 参数
        setState(updates) {
            if(typeof updates === 'function') {
                updates = updates(this.pendingState, this.props)
            }
            this.pendingState = {...this.pendingState, ...updates}

            if(this.inBatchContext) {
                this.stateNeedFlush = true
            } else {
                this._flushState()
            }
        }

        _flushState() {
            super.setState(this.pendingState)
        }

        batchedUpdates(callback) {
            // 支持嵌套使用此方法
            if(this.inBatchContext) callback()

            this.inBatchContext = true
            callback()
            this.inBatchContext = false

            if(this.stateNeedFlush) {
                this._flushState()
                this.stateNeedFlush = false
            }
        }
    }
    return WithPendingState
}
