import invariant from 'invariant'

const promises = Symbol('promises')
const leave = Symbol('leave')

/*
提供一个 host() 方法，对传递给它的 promise 进行托管：
若 component unmount 时有还没结束的 promise，会将其强制结束。

以避免当它们结束、绑定到上面的回调被触发时，因对应的 component 已不存在而报错。

getKey:
    此 decorator 默认会在 component unmount 时 cancel promise，
    但有时候，component 即使没有 unmount，也需要进行 cancel。

    例如一个显示商品资料的页面，从 goods_id=1 切换到 goods_id=2，页面内容完全更换，之前针对 id=1 商品的操作也全都需要取消，
    但 component 并不会 unmount（在 react-router 下）。

    此时就可以传入一个 getKey(props) 函数，由它返回一个代表 component 当前状态的 key，当 key 变化时，就会 cancel promise。
    调用它时，会把 componenent 当前接收到的 props 传给它。
*/
export function hosted(getKey=undefined) {
    invariant(!getKey || typeof getKey === 'function', 'getKey 必须是一个 function')

    return function decorator(Component) {
        class Hosted extends Component {
            static displayName = Component.displayName || Component.name

            constructor(props) {
                super(props)

                this[promises] = []
            }

            componentWillReceiveProps(nextProps) {
                if(getKey && getKey(this.props) !== getKey(nextProps)) {
                    this[leave]()
                }
                if(super.componentWillReceiveProps) super.componentWillReceiveProps(nextProps)
            }

            componentWillUnmount() {
                if(super.componentWillUnmount) super.componentWillUnmount()
                this[leave]()
            }

            /*
            托管一个 promise。
                this.host(promise)
            或
                this.host(func, ...args)
                args 会被传给 func，并对 func 返回的 promise 进行托管
                若 func 返回的不是一个 promise，会报错

            只支持 bluebird promise，因为只有它支持 cancel。
            */
            host(target, ...args) {
                const promise = typeof target === 'function' ? target(...args) : target

                // 不能通过 `target instanceof Promise` 来检查，因为使用者通过 npm link 引入此类库时，它使用的 bluebird 和此类库使用的可能不是同一个实例。
                invariant(promise.cancel && promise.isPending, 'target 或它的返回值必须是 Bluebird Promise')

                this[promises].push(promise)
                return promise
            }

            [leave]() {
                for(const promise of this[promises]) {
                    if(promise.isPending()) {
                        promise.cancel()
                    }
                }
                this[promises] = []
            }
        }
        return Hosted
    }
}
