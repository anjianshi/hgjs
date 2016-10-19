/*
对指定的一系列 method 进行 this 绑定

ES6 class 形式的 React component 里没有 method auto bind 功能，需要手动进行绑定。
此方法可以简化这一过程。
详见： https://facebook.github.io/react/docs/reusable-components.html#no-autobinding
*/
export function bindCallbacks(...methods) {
    return function decorator(Component) {
        class Bound extends Component {
            constructor(props) {
                super(props)

                methods.forEach(name => {
                    if(!this[name]) throw new Error(`bindCallbacks ${Bound.displayName}: method ${name} not exists`)
                    this[name] = this[name].bind(this)
                })
            }
        }
        Bound.displayName = Component.displayName || Component.name
        return Bound
    }
}
