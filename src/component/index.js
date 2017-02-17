/*
定义一些 component 相关的工具函数、decorator、Hoc

= decorator 与 HoC 的区别
. decorator 通常是继承式的，生成一个继承自原 component 的新 component，扩展原 component 的一些行为，并完全代替原 component
. Hoc 则是包裹式的，在原 component 外再包裹一层 component，渲染时，两个 component 都会被渲染


= decorator 范例
除非有特别需求，否则此目录下的 decorator 都应遵守此范例

function someDecorator(Component) {
    class DecoratedClassName extends Component {
        // 保证 Component 原来的 displayName 不会丢失
        static displayName = Component.displayName || Component.name

        someMethod() {}

        componentWillReceiveProps(nextProps) {
            // 在重写 lifecycle 时，不要忘了检查并调用上级 class 里的同名方法
            if(super.componentWillReceiveProps) super.componentWillReceiveProps(nextProps)

            // do somthing...
        }
    }
    return DecoratedClassName
}
*/

export * from './functions'
export { enhanceProps } from './enhanceProps'
export { reduxState } from './reduxState'
export { pendingState } from './pendingState'
export { cacheScrollTop } from './cacheScrollTop'
export { timer } from './timer'
export { hosted } from './hosted'
