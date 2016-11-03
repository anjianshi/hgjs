import React, { PropTypes } from 'react'
import { bindCallbacks, extraProps } from 'component'
import { isEqual, omit } from 'lodash'
import { connect } from 'react-redux'

/*
简易的 navigator（router）
可用于需要 router，但不需要浏览器地址栏及 History API 支持的地方。例如 Electron 以及 ReactNative app。

此 component 必须搭配 hgjs 的 dynamicStore 使用。且一个 app 中只能有一个 Navigator。

使用方法：
1. 先调用 init() 函数进行初始化。
2. 然后在需要使用导航信息的地方引入 withNavData HoC
3. 通过 `import navigator from 'hgjs/navigator'` 引入 navigator 对象，使用它来执行 go / replace... 等导航操作。

导航信息以 props 的形式传递，而没有使用更方便的 context 来传递，是因为使用 context 的话会有延迟问题。
当一个下级 component 也连接了 redux store，并触发了导航操作时，会出现它被重新渲染时，通过 context 读取到的导航信息仍然是更新前的信息的问题。
也就是 store 里的导航信息已经更新了，但是 context object 还没有被重新生成。
*/


// ========== initialize ==========

let reducerNode, options

/*
Navigator 必须先通过此函数初始化才能使用

初始化包含两部分内容：
1. 绑定 redux store（必须是 hgjs 的 dynamicStore）
2. 指定 navigator options

options definition:
    routes: {
        path: Component,
        ...
    }

    // 指定默认使用的 route 的 path（只支持指定 path，不支持指定 data）
    defaultRoute: path

    // 若指定了此 option，则 navigator history 会保持在指定的长度，超出长度时会将多出的部分移除。
    // 主要用来避免 history 的内容无限制的增长。
    // 尤其是 app 实现了 state 持久化的时候，如果不进行限制，那么 app 从最开始使用开始的所有导航信息都会被记录下来。
    historyLimit: number
*/
export function init(store, _options) {
    options = _options
    reducerNode = store.registerReducer('com_navigator', navigatorReducer)
}


// ========== reducer ==========

const ACTION_PREFIX = 'COM_NAVIGATOR/'

// { to: path, data }
const GO = ACTION_PREFIX + 'GO'
const BACK = ACTION_PREFIX + 'BACK'
// { to: path, data }
const REPLACE = ACTION_PREFIX + 'REPLACE'

function navigatorReducer(state=null, action) {
    if(!state) {
        state = {
            // 导航历史记录。最后一条就是当前正在显示的项目。
            history: [
                { path: options.defaultRoute, data: undefined }
                // ...
            ]
        }
    }

    switch(action.type) {
        case GO: {
            const history = [...state.history]
            const currItem = history[history.length - 1]
            if(action.path === currItem.path && isEqual(action.data, currItem.data)) return

            const limit = options.historyLimit
            if(limit && history.length === limit) history.shift()

            history.push({path: action.path, data: action.data})
            return { ...state, history }
        }

        case BACK: {
            const history = [...state.history]
            if(history.length === 1) return state

            history.pop()
            return { ...state, history }
        }

        case REPLACE: {
            const history = [...state.history]
            history[history.length - 1] = { path: action.path, data: action.data }
            return { ...state, history }
        }

        default:
            return state
    }
}



// ========== action creators ==========

function go(to, data) {
    reducerNode.dispatch({ type: GO, path: to, data })
}

function back() {
    reducerNode.dispatch({ type: BACK })
}

function replace(to, data) {
    reducerNode.dispatch({ type: REPLACE, path: to, data })
}


// ========== components / HoC ==========

// 通过引入此 HoC，component 可以得到一个 nav props，里面有当前的导航信息
// 以 decorator 方式使用此 HoC 时，应尽量放在最外面（上面）
export function withNavData(Component) {
    @connect(() => ({
        // 加下划线以避免和使用者手动传入的 props 产生命名冲突
        __history: reducerNode.getState().history
    }))
    class WithNavData extends React.Component {
        render() {
            const history = this.props.__history
            const currItem = history[history.length - 1]

            const props = {
                ...omit(this.props, '__history'),
                nav: {
                    path: currItem.path,
                    data: currItem.data,
                    component: options.routes[currItem.path],
                    isFirst: history.length === 1,
                    defaultRoute: options.defaultRoute,
                }
            }
            return <Component {...props} />
        }
    }
    return WithNavData
}


/*
构建一个能跳转到指定路由的超链接。（实际上不是真正的超链接，只是一个在用户点击时会进行导航的元素）
*/
@connect(() => ({
    // 加下划线以避免和使用者手动传入的 props 产生命名冲突
    __history: reducerNode.getState().history
}))
@bindCallbacks('onClick')
export class Link extends React.Component {
    static propTypes = {
        // 要导航到的路由信息
        to: PropTypes.string,
        data: PropTypes.any,

        // 以 replace 模式执行导航
        replace: PropTypes.bool,

        // 以 back 模式执行导航，此时 to 和 data 无需赋值
        back: PropTypes.bool,

        // replace 和 back 不能同时为 true。若它们都没有指定，默认为 go 模式。

        // 此 props 用于 back 为 true 的情况。
        // 若此 props 设为 true（默认），则当 history 里已经不存在上一条导航信息时，点击链接会跳转到 defaultRoute。
        // 否则，点击链接时不会有任何行为。
        fallback: PropTypes.bool,

        // 通过指定这个 props，可以自定义 Link component 实际使用的 element。
        // 例如不用 <a> 而用 <span> 或 <div>

        // 在 ReactNative 下，因为不存在 <a> 标签，也不存在 onClick 事件，可以自定义一个 component，
        // 把 onClick 事件转译成 RN 下的事件，然后渲染 RN 下的 element。
        BaseComponent: PropTypes.any,

        // 其他 props 都会传给 BaseComponent
    }

    static defaultProps = {
        replace: false,
        back: false,
        fallback: true,
        BaseComponent: props => <a {...props} />
    }

    onClick(e) {
        const history = this.props.__history

        // 确保使用者传进来的 onClick 和此 component 传给 BaseComponent 的 onClick 回调都能被调用
        if(this.props.onClick) this.props.onClick(e)

        if(this.props.back) {
            if(history.length === 1) {
                if(this.props.fallback) go(options.defaultRoute)
            } else {
                back()
            }
        } else {
            const method = this.props.replace ? replace : go
            method(this.props.to, this.props.data)
        }
    }

    render() {
        const props = {
            ...omit(extraProps(this), '__history', 'dispatch'),
            onClick: this.onClick
        }
        return <this.props.BaseComponent {...props} />
    }
}


// ========== exports ==========

export default {
    init, go, replace, back,
}
