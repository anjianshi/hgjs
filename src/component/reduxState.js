import { connect } from 'react-redux'
import { enhanceProps } from './enhanceProps'

/*
用 redux store 来存储 component state
对 state 的操作方法和原生的 component local state 类似。
注意：此 HoC 会覆盖 component 自带的 this.state 和 this.setState。

此 Hoc 提供的功能：
1. cache state。因为在使用 redux store 的情况下，只要不明确清除，state 就会一直留着，所以这个功能很容易实现。
   并且因为 state cache 都统一存放在 redux store 这个单点下，很容易进行持久化。
2. this.state 是实时更新的，不象 component local state 那样有 transaction 的问题；也不象直接使用 react-redux 的 connect() 那样，
   要等下一次渲染才能通过 props 读取到新 state。
3. 由使用者计算出一个 key 来作为 state 存储在 redux store 中的节点，当这个 key 变化时，自动清除当前 state，从新的节点读取 state。

此 HoC 提供的功能和 pendingState 类似。
它比 pendingState 多提供了一个 cache 功能。除了能在 unmount 的情况下保留 state 外，
在需要缓存整个应用的状态时（例如 App 被转入后台），还能做到把处于 mount 状态的 component 的 state 也缓存起来。
与此对应缺点是，必须提供一个独一无二的 key 来存储 state。
因此，在需要缓存 state 的情况下，应使用这个 HoC；如果不需要，则可以使用 pendingState。

**注意！** 因为此 HoC 使用了 react-redux 的 connect()，而 connect() 是一个包裹式而不是继承（extends）式的 HoC，
其他所有继承式的 HoC 应该放在这个 HoC 的前面（下面），不然可能无法正常运行。
例如无法读取原 component 中定义的 method，也无法向 component class 中新增 method。


参数：
options: object || (props) => object

option items:
key
    state 存放在 redux store 中的节点名，同时也会出现于日志里。因此尽量不要太长
    key 中不允许出现 "/" 字符
    （必须，不能重复）

initialState
    初始 state。暂时不支持在 constructor 里通过 `this.state = {...}` 的形式设置初始 state，需要通过 options 指定。（可选）

connector
    此 HoC 通过 react-redux 的 connect() 来把 component state 引入进来。（其实这个引入进来的值并不会被读取，只是利用它来触发 connect() 进行重新渲染）
    使用者通过此回调来引入额外的内容，这样就不用再单独使用 connect() 了。调用时，会把 connect() 传来的参数传给它。（可选）

cache
    默认在 component unmount 时会重置 state（重置为 initialState）。
    将此选项设为 true，可在 unmount 后保留 state，等下次 mount 时继续使用。
    当 component 再次 mount 时，如果因为某些原因（例如所处 routes 变化）不再需要之前缓存起来的 state，
    可在 componentWillMount() 处调用 this.resetState() 清除。


接口：
reduxState.bindStore(store)
    使用此 HoC 前必须先调用此方法进行初始化。其中 store 必须是 dynamicStore（可以是 reducerHost）

this.state
    当前 state。此值永远是最新的 state，不会有延迟的问题，详见下面。
    目前在 constructor() 无法读取此值

this.setState(updates)
    和 react 原生的 this.setState() 类似，但不支持 callback 参数，updates 也不能是函数，只能是 object。
    执行 this.setState() 后，可以立刻在 this.state 中读取到最新的内容。这点和原生的以及默认使用 redux（配合 connect()）时都不一样。
    要注意这一特性是否会带来潜在的问题：例如在 render() 中过早的读取到了原本还不应该读到的内容。

this.batchedUpdates(callback)
    如果想要确保多次 this.setState() 只触发一次重新渲染，可以把他们包裹在一个回调函数里传给此方法。
    此方法会等到回调函数结束后，再把里面对 state 所做的更改一次性写入到 redux store 中。

this.resetState()
    将 comopnent state 还原回 initialState 的状态

this.action_xxx
    所有需要执行 this.setState() 的方法都应以此格式命名。以便提供更有意义的日志信息。
    不然看不出每次更新都是从哪里发起的。

componentDidLoadState、 componentWillClearState
    新增了两个会在初始化 / 切换 / 清除 state 时调用的 lifecycle method。
*/

export function reduxState(getOptions) {
    if(typeof getOptions !== 'function') {
        const options = getOptions
        getOptions = () => options
    }

    // symbols
    const _options = 'reduxState_options'
    const _state = 'reduxState_state'
    const _inBatchContext = 'reduxState_inBatchContext'
    const _needFlushState = 'reduxState_needFlushState'
    const _wrapActionCreators = 'reduxState_wrapActionCreators'
    const _initState = 'reduxState_initState'
    const _loadState = 'reduxState_loadState'
    const _clearState = 'reduxState_clearState'

    const connector = (state, ownProps) => {
        if(!reducerNode) throw new Error('reduxState: 使用前必须先调用 reduxState.bindStore() 进行初始化')

        const options = parseOptions(getOptions, ownProps)
        return {
            [_options]: options,
            [_state]: getState(options.key),
            ...options.connector(state, ownProps)
        }
    }

    return function decorator(Component) {
        @connect(connector)
        @enhanceProps
        class ReduxConnected extends Component {
            static displayName = Component.displayName || Component.name

            constructor(props) {
                super(props)

                this[_inBatchContext] = false
                this[_needFlushState] = false
                if(process.env.NODE_ENV === 'development' && console.debug && console.groupCollapsed) this[_wrapActionCreators]()
            }

            componentWillMount() {
                this[_loadState]()
                if(super.componentWillMount) super.componentWillMount()
            }

            componentWillReceiveProps(nextProps) {
                if(super.componentWillReceiveProps) super.componentWillReceiveProps(nextProps)
                if(nextProps[_options].key !== this.props[_options].key) this[_clearState]()
            }

            componentDidReceiveProps(prevProps) {
                if(prevProps[_options].key !== this.props[_options].key) this[_loadState]()
                if(super.componentDidReceiveProps) super.componentDidReceiveProps(prevProps)
            }

            componentWillUnmount() {
                if(super.componentWillUnmount) super.componentWillUnmount()
                this[_clearState]()
            }

            [_loadState]() {
                this.state = getState(this.props[_options].key)
                if(this.state === undefined) this[_initState]('INIT_STATE')
                if(this.componentDidLoadState) this.componentDidLoadState()
            }

            [_clearState]() {
                if(this.componentWillClearState) this.componentWillClearState()
                if(!this.props[_options].cache) this[_initState]('RESET')
            }

            [_initState](by) {
                this.state = this.props[_options].initialState
                setState(this.props[_options].key, this.state, by, true)
            }

            // 包裹 component class 中的 action creator method，以提供更丰富的日志信息
            [_wrapActionCreators]() {
                const self = this

                // 此 component 接收到的 Component 可能是已经经过多个其他 decorator 继承 / 修饰过的 component。
                // 需要一级一级通过 prototype 递归检查上去，才能找到真正的 app component 中定义的 methods。
                // （因为有些 decorator 例如 cacheScrollTop 也会定义一些 `action_` method，所以中途碰到的这些 method 也要进行处理）
                let obj = this
                while(obj !== null) {
                    for(const name of Object.getOwnPropertyNames(obj)) {
                        if(name.startsWith('action_') && typeof obj[name] === 'function') {
                            const origMethod = obj[name]
                            obj[name] = function loggedActionCreatorWrap(...args) {
                                /*
                                在这里，this 有可能是 component instance，也有可能不是。
                                如果使用者为 action creator 绑定了 this，在调用它时，就无需确保 this 必须指向 component instance，
                                此时，this 就很可能是其他的什么值，这对 method 的运行不会带来任何影响。

                                但也有可能 action creator 没有绑定 this，那么在调用时就必须确保 this 指向 comopnent instance。

                                无论是上面哪种情况，这里都应该把接收到的 this 原样传递给 action creator。
                                也就是让使用者自己控制 action creator 要不要预先绑定 this，以及调用 action creator 时要不要控制 this，此 wrapper 不做干涉。
                                不过因为此 wrapper 本身的运行需要用到 component instance，所以额外建立了一个 self 变量，对于 wrapper 自身，使用这个变量而不是 this。
                                */
                                return loggedActionCreator.call(this, self, self.props[_options].key, origMethod, name, ...args)
                            }
                        }
                    }
                    obj = Object.getPrototypeOf(obj)
                }
            }

            setState(updates) {
                this.state = {...this.state, ...updates}
                if(this[_inBatchContext]) {
                    this[_needFlushState] = true
                } else {
                    setState(this.props[_options].key, updates)
                }
            }

            resetState() { this[_initState]('MANUAL_RESET') }

            batchedUpdates(callback) {
                // 支持嵌套使用此方法
                if(this[_inBatchContext]) return callback()

                this[_inBatchContext] = true
                callback()
                this[_inBatchContext] = false

                if(this[_needFlushState]) {
                    setState(this.props[_options].key, this.state, 'FLUSH', true)
                    this[_needFlushState] = false
                }
            }
        }

        return ReduxConnected
    }
}

// ===============================

const defaultOptions = {
    key: undefined,
    initialState: {},
    cache: false,

    connector: () => ({}),
}

function parseOptions(getOptions, props) {
    const options = getOptions(props)
    if(!options.key.indexOf('/') === -1) throw new Error('reduxState: key 中不能包含 "/" 字符')
    if('initialState' in options && options.initialState === undefined) throw new Error('reduxState: initialState 不允许明确指定为 undefined')

    Object.keys(options).forEach(key => {
        if(!(key in defaultOptions)) throw new Error('错误的 options key: ' + key)
    })

    return {...defaultOptions, ...options}
}


const style = 'color: #165be3;'
let no = 1

function loggedActionCreator(componentInstance, key, origMethod, methodName, ...args) {
    const com = componentInstance

    // 通过这个 no 可以跟踪 action 的发生顺序。
    // 当 action 中出现嵌套时，如 action a 调用 action b，因为 action b 会比 action a 先结束，所以它的日志信息也会先出现
    // 这样一来 action 之间究竟是谁先运行的就搞不清楚了，这时就可以根据这个 no 来判断。
    const currNo = no++

    const date = new Date()
    const timeStr = date.getHours() + ':' + date.getMinutes() + ':' + date.getSeconds() + '.' + date.getMilliseconds()

    const prevState = {...com.state}
    const result = origMethod.apply(this, args) // eslint-disable-line no-invalid-this

    console.groupCollapsed(`%c${currNo} localAction @ ${timeStr} ${key} :: ${methodName}`, style)
    console.debug('arguments', ...args)
    // 因为 React 的 state 并不是实时更新的，所以 prev / current  state 不一定能反应此时的真实情况
    console.debug('prev state', prevState)
    console.debug('current state', com.state)
    console.groupEnd()

    return result
}

// ===============================

// { updates, replace }
// key 是要更新的 component 的 state 在 store 里挂载的节点名
// replace 若为 true，会用 updates 整个替换原来的 state
//
// 为便于查看日志，使用时，需要把 key 附加到 ACTION_PREFIX 后面，而不是通过 action object 来传递。
// 此外，还允许在 key 后面再额外附加其他信息
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

let reducerNode

reduxState.bindStore = function bindStore(store) {
    reducerNode = store.registerReducer('reduxState', reduxStateReducer)
}

function getState(key) {
    return reducerNode.getState()[key]
}

function setState(key, updates, by=null, replace=false) {
    const action = ACTION_PREFIX + key + (by ? '/' + by : '')
    reducerNode.dispatch({ type: action, updates, replace })
}
