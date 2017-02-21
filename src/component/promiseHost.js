import invariant from 'invariant'

/*
在我们的 component 里经常要发起一些异步操作，并注册一些回调：当异步操作完成时，更新 redux store、component local state 或针对 component refs 执行某些操作。
如果一个 component 在它发起的异步操作完成之前就 unmount 了，那些回调将无法正常执行，甚至会导致报错。
因此我们需要有一个机制，保证在 component unmount 后能结束异步操作或让回调不再被触发。

通过此工具就能实现上面的目的。
此工具要求把异步操作封装成 promise 传给它，它会在 component unmount 时，cancel 掉所有传给它的、尚未完成的 promise。
使用者可以通过在构建 promise 时选择是否指定 onCancel 回调，来自行决定一项异步操作在 component unmount 时是要结束运行，还是不结束运行、只是让回调不再被调用。

使用方法：

// 构建一个 host 实例
const host = makePromiseHost()

// 把 host 实例绑定到指定 component 上,
// 每当这个 component unmount 时，就会对 promsie 执行清理工作
@host.bind(getKey)
class Com extends React.Component {
    fn() {
        // 执行异步操作时，要把生成的 promise 传给 host，
        // 没有传给 host 的 promise 不会被清理
        host(promise)

        // 也可以通过 this.host() 来调用
        this.host(promise)
    }
    ...
}

// 在 component 外，也可以向 host 传递 promise，
// 它们也会在 component unmount 时被清理
host(promise)


// 如果不需要在 component 外使用 host，也可以使用快捷方式： @hosted()，相当于 @makePromiseHost().bind()
@hosted()
class Com extends React.Component { ... }
*/
export function makePromiseHost() {
    let promises = []

    /*
    托管一个 promise。
        this.host(promise)
    或
        this.host(func, ...args)
        args 会被传给 func，并对 func 返回的 promise 进行托管
        若 func 返回的不是一个 promise，会报错

    只支持 bluebird promise，因为只有它支持 cancel。
    */
    function host(target, ...args) {
        const promise = typeof target === 'function' ? target(...args) : target

        // 不能通过 `target instanceof Promise` 来检查，因为使用者通过 npm link 引入此类库时，它使用的 bluebird 和此类库使用的可能不是同一个实例。
        invariant(promise.cancel && promise.isPending, 'target 或它的返回值必须是 Bluebird Promise')

        promises.push(promise)
        return promise
    }

    // 清理未完成的 promise
    function clear() {
        for(const promise of promises) {
            if(promise.isPending()) {
                promise.cancel()
            }
        }
        promises = []
    }

    /*
    绑定 component

    getKey:
        此 decorator 默认会在 component unmount 时 cancel promise，
        但有时候，component 即使没有 unmount，也需要进行 cancel。

        例如一个显示商品资料的页面，从 goods_id=1 切换到 goods_id=2，页面内容完全更换，之前针对 id=1 商品的操作也全都需要取消，
        但 component 并不会 unmount（在 react-router 下）。

        此时就可以传入一个 getKey(props) 函数，由它返回一个代表 component 当前状态的 key，当 key 变化时，就会 cancel promise。
        调用它时，会把 componenent 当前接收到的 props 传给它。
    */
    function bind(getKey=undefined) {
        invariant(!getKey || typeof getKey === 'function', 'getKey 必须是一个 function')

        return function decorator(Component) {
            class Hosted extends Component {
                static displayName = Component.displayName || Component.name

                constructor(props) {
                    super(props)

                    this.host = host
                }

                componentWillReceiveProps(nextProps) {
                    if(getKey && getKey(this.props) !== getKey(nextProps)) {
                        clear()
                    }
                    if(super.componentWillReceiveProps) super.componentWillReceiveProps(nextProps)
                }

                componentWillUnmount() {
                    if(super.componentWillUnmount) super.componentWillUnmount()
                    clear()
                }
            }
            return Hosted
        }
    }

    host.bind = bind
    return host
}


export function hosted(...args) {
    return makePromiseHost().bind(...args)
}
