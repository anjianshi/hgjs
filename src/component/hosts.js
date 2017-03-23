import invariant from 'invariant'
import { makePromiseHost, makeTimerHost } from 'hosts'

/*
关于 getKey

以下 host decorator 默认都会在 component unmount 时执行 clear 操作。
但有时候，component 即使没有 unmount，也需要进行 clear。

例如一个显示商品资料的页面，从 goods_id=1 切换到 goods_id=2，页面内容完全更换，之前针对 id=1 商品的操作也全都需要取消，
但 component 并不会 unmount（在 react-router 下）。

因此，这些 decorator 也都接收一个 getKey(props) 函数，每当 component 接收到的 props 变化时，就会把最新的 props 传给它，
由它返回一个代表 component 当前状态的 key，当 key 变化时，就会进行 clear。
*/


/*
为 component 绑定一个 promiseHost，在 component unmount 时，自动进行 cancel promise。

若传入 hostPromiseFunc，则把一个现有的 hostPromise function 绑定到 component 上，以实现在 component 外生成 promise，
但在 component unmount 时 cancel 执行 promise。

若不传入 hostPromiseFunc，则为每个 component 实例构建一个专属于它的 hostPromise function。

接口：
this.hostPromise        此即为绑定到此 component 上的 hostPromise function

------

这一功能非常常用。因为我们经常需要在 component 运行过程中发起一些异步操作，并在操作完成时触发一些回调。
回调的内容可能是更新 redux store、component local state 或针对 component refs 执行某些操作。
这些操作只能在 component mount 的状态下执行，因此我们必须保证在 component unmount 时妥善地取消尚未完成的异步操作，以免 unmount 后触发回调。
*/
export function withPromiseHost(getKey=null, hostPromiseFunc=null) {
    invariant(!getKey || typeof getKey === 'function', 'getKey 必须是一个 function')

    return function decorator(Component) {
        class PromiseHosted extends Component {
            static displayName = Component.displayName || Component.name

            constructor(props) {
                super(props)

                this.hostPromise = hostPromiseFunc || makePromiseHost()
            }

            componentWillReceiveProps(nextProps) {
                if(getKey && getKey(this.props) !== getKey(nextProps)) {
                    this.hostPromise.clear()
                }
                if(super.componentWillReceiveProps) super.componentWillReceiveProps(nextProps)
            }

            componentWillUnmount() {
                if(super.componentWillUnmount) super.componentWillUnmount()
                this.hostPromise.clear()
            }
        }
        return PromiseHosted
    }
}


/*
为 component 绑定一个 timer host，在 component unmount 时自动对 timer 进行 clear

接口：
this.setTimeout()
this.setInterval()
*/
export function withTimer(getKey=null) {
    return function decorator(Component) {
        class WithTimer extends Component {
            static displayName = Component.displayName || Component.name

            constructor(props) {
                super(props)

                // 因为一个 component 可能会有多个实例（在同一个页面内多次出现），
                // 因此必须为每个实例单独创建 host，而不能在全局范围内创建
                this._timerHost = makeTimerHost()
            }

            componentWillReceiveProps(nextProps) {
                if(getKey && getKey(this.props) !== getKey(nextProps)) {
                    this._timerHost.clear()
                }
                if(super.componentWillReceiveProps) super.componentWillReceiveProps(nextProps)
            }

            componentWillUnmount() {
                if(super.componentWillUnmount) super.componentWillUnmount()
                this._timerHost.clear()
            }

            setTimeout(...args) {
                return this._timerHost.setTimeout(...args)
            }

            setInterval(...args) {
                return this._timerHost.setInterval(...args)
            }
        }
        return WithTimer
    }
}

