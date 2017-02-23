import React, { PropTypes } from 'react'
import { connect } from 'react-redux'
import { pick, isEqual } from 'lodash'
import { extraProps } from 'component'
import { libReducerHost } from 'init'


/*
简易的 navigator（router）
可用于需要 router，但不需要浏览器地址栏及 History API 支持的地方。例如 Electron 以及 ReactNative app。

使用此 component 前需要先初始化 init/libReducerHost。
一个 app 中只能有一个 Navigator。

使用方法：
1. 用 <Navigator> 包裹 app 的根 component，并把 react-redux 的 <Provider> 包裹在 <Navigator> 外面
2. <Navigator> 会把当前要渲染的路由 component 通过 children props 传给 app 的根 component，根 component 直接渲染它即可
3. <Navigator> 生成路由 component 时，会把当前的导航信息通过各 props 传给它
4. 各 component 要执行导航操作时，可以通过 `import navigator from 'hgjs/navigator' 引入 navigator 对象，
   然后就可以通过它来执行操作了。

导航信息以 props 的形式传递，而没有使用更方便的 context 来传递，是因为使用 context 的话会有延迟问题。
当一个下级 component 也连接了 redux store，并触发了导航操作时，会出现它被重新渲染时，通过 context 读取到的导航信息仍然是更新前的信息的问题。
也就是 store 里的导航信息已经更新了，但是 context object 还没有被重新生成。
*/


let options


// ========== reducer ==========

// { to: path, data }
const GO = 'GO'

// { fallback: bool }
// 若 fallback 为 true（默认），则当历史记录里已经没有上一条，无法再 back 回去时，会跳转到 defaultPath；
// 否则，执行 BACK 不会有任何行为
const BACK = 'BACK'

// { to: path, data }
const REPLACE = 'REPLACE'

function navigatorReducer(state=null, action) {
    if(!state) {
        state = {
            // 导航历史记录。最后一条就是当前导航到的项目。
            history: [
                { path: options.defaultPath, data: undefined }
                // ...
            ]
        }
    }

    switch(action.type) {
        case GO: {
            const path = action.path === 'default' ? options.defaultPath : action.path
            const history = [...state.history]
            const currItem = history[history.length - 1]
            if(path === currItem.path && isEqual(action.data, currItem.data)) return

            const limit = options.historyLimit
            if(limit && history.length === limit) history.shift()

            history.push({path, data: action.data})
            return { ...state, history }
        }

        case BACK: {
            const history = [...state.history]
            if(history.length === 1) {
                if(action.fallback === false) return state
                history.unshift({ path: options.defaultPath })
            }

            history.pop()
            return { ...state, history }
        }

        case REPLACE: {
            const path = action.path === 'default' ? options.defaultPath : action.path
            const history = [...state.history]
            history[history.length - 1] = { path, data: action.data }
            return { ...state, history }
        }

        default:
            return state
    }
}

const { getState, dispatch } = libReducerHost.registerReducer('hgjs.navigator', navigatorReducer)



// ========== action creators ==========

function go(to, data) {
    dispatch({ type: GO, path: to, data })
}

function back(fallback=true) {
    dispatch({ type: BACK, fallback })
}

function replace(to, data) {
    dispatch({ type: REPLACE, path: to, data })
}


// ========== components ==========

// 此 component 实际的作用是接收 store 及 options。
// 对导航 component 的渲染操作由 NavigatorRender 来完成。
export class Navigator extends React.Component {
    static contextTypes = {
        // 必须是 hgjs 的 dynamicStore
        store: PropTypes.object.isRequired,
    }

    static propTypes = {
        // { path: Component, ... }
        // path 不能为 'default'，这是一个保留字，用来指定导航到默认路由
        routes: PropTypes.object.isRequired,

        // 默认导航到那个 route。
        // navigator 初始化时会导航到此 path；执行导航跳转操作时，也可以通过将 path 指定为 'default' 来跳转到此 path
        defaultPath: PropTypes.string.isRequired,

        // 若指定了此 props，则 navigator history 会保持在指定的长度，超出长度时会将多出的部分移除。
        // 主要用来避免 history 的内容无限制的增长。
        // 尤其是 app 实现了 state 持久化的时候，如果不进行限制，那么 app 从最开始使用开始的所有导航信息都会被记录下来。
        historyLimit: PropTypes.number,

        children: PropTypes.node.isRequired,
    }

    componentWillMount() {
        this.prepare(this.props)
    }

    componentWillReceiveProps(nextProps) {
        this.prepare(nextProps)
    }

    prepare(props) {
        options = pick(props, 'routes', 'defaultPath', 'historyLimit')
    }

    render() {
       return <NavigatorRender>{this.props.children}</NavigatorRender>
    }
}


@connect(() => getState())
class NavigatorRender extends React.Component {
    static propTypes = {
        children: PropTypes.node.isRequired,
    }

    render() {
        const { history } = this.props
        const { routes } = options

        const currItem = history[history.length - 1]
        const Component = routes[currItem.path]
        const navData = {
            path: currItem.path,
            data: currItem.data,
            isFirst: history.length === 1,  // 当前项是否已经是导航历史记录里的第一项（已经没法再进行 back 了）
        }

        return React.cloneElement(this.props.children, {
            children: <Component nav={navData} />
        })
    }
}


/*
构建一个能跳转到指定路由的超链接。（实际上不是真正的超链接，只是一个在用户点击时会进行导航的元素）
*/
export class Link extends React.Component {
    static propTypes = {
        // 要导航到的路由信息
        to: PropTypes.string,
        data: PropTypes.any,

        // 以 replace 模式执行导航
        replace: PropTypes.bool,

        // 以 back 模式执行导航，此时 to 和 data 无需赋值
        back: PropTypes.bool,

        // 控制是否以 fallback 模式执行 back 导航
        fallback: PropTypes.bool,

        // replace 和 back 不能同时为 true。若它们都没有指定，默认为 go 模式。

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

    onClick = (e) => {
        // 确保使用者传进来的 onClick 和此 component 传给 BaseComponent 的 onClick 回调都能被调用
        if(this.props.onClick) this.props.onClick(e)

        if(this.props.back) {
            back(this.props.fallback)
        } else {
            const method = this.props.replace ? replace : go
            method(this.props.to, this.props.data)
        }
    }

    render() {
        const props = {
            ...extraProps(this),
            onClick: this.onClick
        }
        return <this.props.BaseComponent {...props} />
    }
}


// ========= exports ==========

export default {
    go,
    replace,
    back
}
