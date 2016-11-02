import React, { PropTypes } from 'react'
import { reduxState, bindCallbacks, extraProps } from 'component'
import { isEqual } from 'lodash'


/*
简易的 navigator（router）
可用于需要 router，但不需要浏览器地址栏及 History API 支持的地方。例如 Electron 以及 ReactNative app。

此 component 会生成一个 navigator 对象， app 就通过这个对象来获取导航信息以及执行导航操作。
这个对象会通过 nav context 提供；此外，如果传给这个 component 的 children 是一个 function，还会把这个对象作为参数传给这个 function。

此 component 必须搭配 redux store 使用，且一个 app 中只能有一个 Navigator。
*/


function makeRoute(path, routeData) {
    return { path, data: routeData }
}


@reduxState(props => ({
    key: 'com-navigator',
    initialState: {
        routeStack: [makeRoute(props.defaultRoute, null)]
    },
    // 这个不设为 true 的话，HMR 状态下，每次因代码更新而重新渲染，因为都会有一个 unmount / mount 的过程，
    // 所以 route stack 就会被清空。
    cache: true,
}))
@bindCallbacks('action_pushRoute', 'action_popRoute', 'action_replaceRoute')
export class Navigator extends React.Component {
    static propTypes = {
        // 定义此 app 的 routes 列表。格式： { path: component, ... }
        routes: PropTypes.object.isRequired,

        // 指定默认显示的 route（只支持指定 path，不支持指定 data）
        defaultRoute: PropTypes.string.isRequired,

        // 若指定了此 props，则 route stack 会保持在指定的长度，超出长度时会将多出的部分移除
        // 主要用来避免 route stack 的内容无限制的增长，
        // 尤其是 app 实现了 state 持久化的时候，如果不进行限制，那么 app 从最开始使用开始的所有 route 都会被记录下来。
        stackLimit: PropTypes.number,

        children: PropTypes.oneOfType([
            PropTypes.node,
            PropTypes.func,
        ]).isRequired,
    }

    static childContextTypes = {
        nav: PropTypes.object.isRequired,
    }

    getChildContext() {
        return {
            nav: this.generateNavObj()
        }
    }

    // ===== actions =====

    // 向 route stack 中添加一条记录
    action_pushRoute(path, routeData) {
        const stack = [...this.state.routeStack]

        const current = stack[stack.length - 1]
        if(path === current.path && isEqual(routeData, current.data)) return

        const limit = this.props.stackLimit
        if(limit && stack.length === limit) stack.shift()

        stack.push(makeRoute(path, routeData))
        this.setState({ routeStack: stack })
    }

    action_popRoute() {
        const stack = [...this.state.routeStack]
        if(stack.length === 1) return

        stack.pop()
        this.setState({ routeStack: stack })
    }

    action_replaceRoute(path, routeData=null) {
        const stack = [...this.state.routeStack]
        stack[stack.length - 1] = makeRoute(path, routeData)
        this.setState({ routeStack: stack })
    }

    // ===== methods =====

    generateNavObj() {
        const stack = this.state.routeStack
        const currRoute = stack[stack.length - 1]

        return {
            path: currRoute.path,
            data: currRoute.data,
            component: this.props.routes[currRoute.path],
            isFirst: stack.length === 1,
            stack: this.state.routeStack,
            defaultRoute: this.props.defaultRoute,

            go: this.action_pushRoute,
            back: this.action_popRoute,
            replace: this.action_replaceRoute,
        }
    }

    // ======================================

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

        // 若此 props 为 true，则点击此链接时会返回上一个路由。（此时 to / data props 会失效）
        back: PropTypes.bool,
        // 对于 back 为 true 的链接，若 route stack 里已经不存在上一个路由，则在 props 设为 true（默认）的情况下，
        // 会改为跳转到 defaultRoute（必须给 Navigator 指定 defaultRoute 才有效）；
        // 否则，点击链接不会有任何反应
        fallback: PropTypes.bool,

        BaseComponent: PropTypes.any,
        // 其他 props 会直接传给 BaseComponent
    }

    static defaultProps = {
        replace: false,
        fallback: true,
        BaseComponent: props => <a {...props} />
    }

    static contextTypes = {
        nav: PropTypes.object.isRequired,
    }

    jump() {
        const nav = this.context.nav

        if(this.props.back) {
            if(nav.isFirst) {
                if(this.props.fallback && nav.defaultRoute) {
                    nav.go(nav.defaultRoute)
                }
            } else {
                nav.back()
            }
        } else {
            const method = this.props.replace ? 'replace' : 'go'
            nav[method](this.props.to, this.props.data)
        }
    }

    render() {
        const { BaseComponent } = this.props
        return <BaseComponent {...extraProps(this)} onClick={this.jump} />
    }
}
