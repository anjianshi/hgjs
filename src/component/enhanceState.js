import hoistNonReactStatic from 'hoist-non-react-statics'

/*
pending state
batchedUpdates
setState logging

此 decorator 对 React 中对 state 的处理机制进行了改进。

1. React 中，执行 setState() 后，this.state 并不一定会立刻更新，此时读取它有可能读到的仍是老的 state。
   这是因为 React 有一个 transaction 机制，在一些情况下（例如在一个事件回调中），会把多次 setState() 合并到一起，
   而 this.state 要等到 transaction 结束后，才会真正被更新。

   问题在于，React 没有提供一个方便的渠道，让我们能读取到 transaction 内的 pending state，这会带来很多不便。
   因此，此 decorator 额外维护了一个 pendState 属性（其名字代表 pending state），通过它我们可以保证总是能读到最新的 state。

   对此问题的详细讨论：
    https://groups.google.com/d/msg/reactjs/R61kPjs-yXE/88npvV3kFr4J
    http://www.bennadel.com/blog/2893-setstate-state-mutation-operation-may-be-synchronous-in-reactjs.htm
    https://github.com/facebook/react/issues/122
    https://www.google.co.jp/webhp?sourceid=chrome-instant&ion=1&espv=2&ie=UTF-8#q=react%20immediate%20setState

2. 上面提到了 React 的 transaction 机制，这是一个很有用的机制，通过合并多次 setState()，可以减少渲染次数，提升性能。
   但这个机制是被动触发的，一般只会在事件回调内起作用，在其他环境下无效。
   对此，ReactDOM 提供了一个 unstable_batchedUpdates() 方法，使我们能手动开启 transaction，但它只在 DOM 环境下有效，在像 ReactNative 等环境下就不能使用了。
   因此，此 decorator 还提供了一个 batchedUpdates() 方法，它接收一个回调函数，在这个回调函数里执行任意多次 setState() 都会被合并到一起，只触发一次更新。

3. React 的 setState() 还有一个不足之处，就是不像 redux store 那样，可以通过 redux-logger 来记录对 state 的每一次更新，以便于调试。
   为此，此 decorator 给 setState() 增加了一个 describe 参数，凡是指定了这个参数的调用，都会在 console 里记录下来。


接口：
this.pendState
    通过此属性总是能读到最新的 state

this.batchedUpdates(callback)
    在这个方法的回调里执行 setState()，可以保证多次 state 更新只触发一次重新渲染

this.setState(describe, updates)
this.setState(updates)
    指定了 describe 的情况下，这次调用的相关信息会被记录到 console 里。
    updates 只能是 plain object，不支持 callback 等格式
*/
export function enhanceState(Component) {
    class StateEnhanced extends Component {
        static displayName = Component.displayName || Component.name

        constructor(props) {
            super(props)

            this.pendState = this.state

            this._inBatchContext = false
            this._stateNeedFlush = false
        }

        // 与 React 原生的此方法相比，不支持 callback 参数
        setState(...args) {
            const [describe, updates] = args.length === 1 ? [null, args[0]] : args

            const prevState = this.pendState
            const currState = {...prevState, ...updates}
            if(process.env.NODE_ENV === 'development' && describe) {
                logging(StateEnhanced.displayName, describe, prevState, updates, currState)
            }

            this.pendState = currState

            if(this._inBatchContext) {
                this._stateNeedFlush = true
            } else {
                this._flushState()
            }
        }

        _flushState() {
            super.setState(this.pendState)
        }

        batchedUpdates(callback) {
            // 支持嵌套使用此方法
            if(this._inBatchContext) callback()

            this._inBatchContext = true
            callback()
            this._inBatchContext = false

            if(this._stateNeedFlush) {
                this._flushState()
                this._stateNeedFlush = false
            }
        }
    }

    return hoistNonReactStatic(StateEnhanced, Component)
}



const style = 'color: #165be3;'

function logging(componentName, describe, prevState, updates, currState) {
        const date = new Date()
        const timeStr = date.getHours() + ':' + date.getMinutes() + ':' + date.getSeconds() + '.' + date.getMilliseconds()

        // 注意，因为 React 的 state 并不是实时更新的，所以 prev / current state 未必能反应此时的真实情况
        if(!console.groupCollapsed) {   // 像 ReactNative 之类的环境可能没有 console.groupCollapsed() 方法
            console.log(`setState @ ${timeStr} ${componentName}::${describe}`)
            console.log('prev state', prevState)
            console.log('updates', updates)
            console.log('current state', currState)
        } else {
            console.groupCollapsed(`%c setState @ ${timeStr} ${componentName}::${describe}`, style)
            console.debug('prev state', prevState)
            console.debug('updates', updates)
            console.debug('current state', currState)
            console.groupEnd()
        }
}
