import React, { PropTypes } from 'react'
import { pendingState, bindCallbacks, extraProps } from 'component'
import { isEqual } from 'lodash'


/*
简易的 navigator（router）
可用于需要 router，但不需要浏览器地址栏及 History API 支持的地方。例如 Electron 以及 ReactNative app。

此 component 会生成一个 navigator 对象，通过这个对象来获取导航信息以及执行导航操作。
这个对象会通过 nav context 提供；此外，如果传给这个 component 的 children 是一个 function，还会把这个对象作为参数传给这个 function。
*/
@pendingState
@bindCallbacks('go', 'back', 'replace')
export class Navigator extends React.Component {
    static propTypes = {
        // 定义此 app 的 routes 列表。格式： { path: component, ... }
        routes: PropTypes.object.isRequired,

        // 指定 app 刚启动时要显示的 route。在 initialRouteStack 有值的情况下可以不指定
        defaultRoute: PropTypes.string,

        // 在 app 启动时直接将指定的 route stack 填充进去。
        // 可在 app 被终止后、从持久化存储里还原状态时用到。
        // 在设置了此属性的情况下，会把 route stack 里最后一个 route 作为当前 route，而不再使用 defaultRoute
        initialRouteStack: PropTypes.arrayOf(
            PropTypes.shape({
                path: PropTypes.string.isRequired,
                data: PropTypes.any,
            })
        ),

        children: PropTypes.oneOfType([
            PropTypes.node,
            PropTypes.func,
        ]).isRequired,
    }

    static childContextTypes = {
        nav: PropTypes.object.isRequired,
    }

    constructor(props) {
        super(props)

        this.state = {
            routeStack: props.initialRouteStack
                ? props.initialRouteStack
                : [this.makeRoute(props.defaultRoute, null)]
        }
    }

    getChildContext() {
        return {
            nav: this.generateNavObj()
        }
    }

    // ======================================

    makeRoute(path, routeData) {
        return { path, data: routeData }
    }

    go(path, routeData=null) {
        const stack = this.pendingState.routeStack

        const current = stack[stack.length - 1]
        if(path === current.path && isEqual(routeData, current.data)) return

        this.setState({
            routeStack: [...stack, this.makeRoute(path, routeData)]
        })
    }

    back() {
        const stack = [...this.pendingState.routeStack]
        if(stack.length === 1) return

        stack.pop()
        this.setState({ routeStack: stack })
    }

    replace(path, routeData=null) {
        const stack = [...this.pendingState.routeStack]
        stack[stack.length - 1] = this.makeRoute(path, routeData)
        this.setState({ routeStack: stack })
    }

    generateNavObj() {
        const stack = this.state.routeStack
        const currRoute = stack[stack.length - 1]

        return {
            path: currRoute.path,
            data: currRoute.data,
            component: this.props.routes[currRoute.path],
            isFirst: stack.length === 1,
            stack: this.state.routeStack,

            go: this.go,
            back: this.back,
            replace: this.replace,
        }
    }

    render() {
        const { children } = this.props
        return typeof children === 'function' ? children(this.generateNavObj()) : children
    }
}


/*
构建一个能跳转到指定路由的超链接。
（实际上不是真正的超链接，只是一个在用户点击时会执行路由跳转的元素）

BaseComponent:
通过指定这个 props，可以自定义 Link component 实际使用的 element。
例如不用 <a> 而用 <span> 或 <div>

在 ReactNative 下，因为不存在 <a> 标签，也不存在 onClick 事件，可以自定义一个 component，
把 onClick 事件转译成 RN 下的事件，然后渲染 RN 下的 element。
*/
@bindCallbacks('jump')
export class Link extends React.Component {
    static propTypes = {
        to: PropTypes.string,
        data: PropTypes.any,
        // 若为 true，则会用新 route 替换当前 route，而不是在 route stack 里新增一条记录。
        replace: PropTypes.bool,

        // 若次 props 为 true，则点击此链接时会返回上一个路由。（此时 to / data props 会失效）
        back: PropTypes.bool,

        BaseComponent: PropTypes.any,
        // 其他 props 会直接传给 BaseComponent
    }

    static defaultProps = {
        replace: false,
        BaseComponent: props => <a {...props} />
    }

    static contextTypes = {
        nav: PropTypes.object.isRequired,
    }

    jump() {
        if(this.props.back) {
            this.context.nav.back()
        } else {
            const method = this.props.replace ? 'replace' : 'go'
            this.context.nav[method](this.props.to, this.props.data)
        }
    }

    render() {
        const { BaseComponent } = this.props
        return <BaseComponent {...extraProps(this)} onClick={this.jump} />
    }
}
