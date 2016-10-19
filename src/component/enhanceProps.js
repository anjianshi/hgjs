/*
react 中，当想要在 componentWillReceiveProps() 中调用 component 的一些方法来针对新接收到的 props 进行一些行为时，
必须把 nextProps 整个或提取一部分传过去，比较麻烦。
尤其是当这些方法既能被 componentWillReceiveProps 调用，又能在其他可以直接读取 this.props 的环境下调用的话，
它们还要判断是使用传入的 props 参数还是 this.props。

此 HoC 向 component 中补充一个 componentDidReceiveProps lifecycle 方法。
在这个方法发生时，this.props 已被更新为 nextProps 的值。
把上面提到的那些方法放到这个 lifecycle 中调用，即可解决之前碰到的问题。

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
    return WithThroughProps
}
