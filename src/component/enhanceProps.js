import hoistNonReactStatic from 'hoist-non-react-statics'

/*
通常情况下，如果我们要在 React 的 componentWillReceiveProps() 中调用 component 的一些方法来处理新接收到的 props，
我们需要手动把新的 props 传给那个 component method，不然它通过 this.props 没有办法读取到它。

如果这个 component method 既要被 componentWillReceiveProps() 调用，又会在其他可以直接读取 this.props 的环境下调用的话，事情还会变得更麻烦。
它还得想办法去检查，是应该从参数里获得 props，还是通过 this.props 读取。

此 decorator 就是用来解决此问题。
它会向 component 中补充一个 componentDidReceiveProps lifecycle 方法。
在这个方法发生时，this.props 已被更新为 nextProps 的值。
只要把原本在 componentWillReceiveProps() 中执行的内容，移动到这个 lifecycle 里执行，即可解决上面的问题。

接口:
componentDidReceiveProps(prevProps)
*/
export function enhanceProps(Component) {
    class WithThroughProps extends Component {
        static displayName = Component.displayName || Component.name

        componentWillReceiveProps(nextProps) {
            if(super.componentWillReceiveProps) super.componentWillReceiveProps(nextProps)

            const prevProps = this.props
            this.props = nextProps
            if(this.componentDidReceiveProps) this.componentDidReceiveProps(prevProps)
        }
    }

    return hoistNonReactStatic(WithThroughProps, Component)
}
