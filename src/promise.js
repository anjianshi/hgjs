import { Promise as BluebirdPromise } from 'bluebird'


/*
生成一个经过定制和扩展的 bluebird Promise 实例。
（扩展了的内容见 initPromiseLib()）

这里新建了一个 Promise 实例，而不是直接对 bluebird 默认给出的实例进行扩展，
因此使用者必须通过此类库而不是直接从 bluebird 处取得 Promise 实例，不然就无法获得经过配置和扩展的功能。

这样设计是为了避免一会儿从此类库、一会儿从 bluebird 处引入 Promise 带来的混乱。
因为以后维护代码时会搞不清楚这两者功能上是否有区别。
*/
export const Promise = BluebirdPromise.getNewLibraryCopy()
initPromiseLib(Promise)


// =========================================


/*
对 bluebird Promise 实例进行配置

config: 自定义 promise config
extend: 是否为这个 Promise 添加扩展功能
*/
function initPromiseLib(Promise, config=null, extend=true) {
    Promise.config({
        warning: process.env.NODE_ENV === 'development',
        longStackTraces: process.env.NODE_ENV === 'development',
        cancellation: true,
        ...config
    })

    if(!extend) return

    /*
    通过这两个方法实现提前退出一个 promise chain

    promise.then(() => {
        Promise.abort()
    }).then().then().then().catch(Promise.handleAbort)
    */
    const ABORT_MESSAGE = '@@PROMISE_ABORT'
    Promise.abort = () => { throw new Error(ABORT_MESSAGE) }
    Promise.handleAbort = error => {
        if(error.message !== ABORT_MESSAGE) { throw error }
    }

    /*
    生成一个新的、独立的 Promise 实例，并对其进行初始化
    */
    Promise.getNewInitedLibraryCopy = function(...args) {
        const NewPromise = Promise.getNewLibraryCopy()
        initPromiseLib(NewPromise, ...args)
        return NewPromise
    }
}


// =========================================


/*
JavaScript 原生的 Promise 是不支持的 cancel 的，
因此，基于原生 Promise 规范设计出来的 async function 也是一但执行，就没有什么机制能使其中途结束。

因为我们现在使用的是支持 cancel 的 bluebird Promise，因此针对 async function 最好也能提供一种方便的中断机制。

单纯地把 bluebird Promise 设置成 global Promise 能使 async function 返回的 promise 对象有了 cancel() 方法，
但是调用 cancel() 方法时，function 本身的执行并不会被终止。

通过使用下面提供的 cancellableAsync() 工具，可以更彻底地解决这个问题。

使用方法如下：

// 用 cancellableAsync() 包裹 async function 定义，async function 在原本参数列表的基础上，额外接收一个 ctx 参数。
// 下面的 func 就是一个定义好了的可中断的 async function，调用它会返回一个 bluebird Promise，支持 .cancel() 操作。
const func = cancellableAsync(async function(ctx, ...someArgs) => {
    await asyncAction1()

    // 通过 ctx.cancelled 检查使用者是否已执行了 cancel() 操作，若已 cancel，则此函数不再继续运行
    // 这里的 return 不用带任何值，带了也没用。因为使用者已经 cancel promise，这里即使返回了值使用者也接收不到。
    if(ctx.cancelled) return

    await asyncAction2()

    if(ctx.cancelled) {
        // 在终止运行前，也可以先执行一些收尾操作
        // do something...
        return
    }

    await asyncAction3()
    return result
})


class SomeCom extends React.Component {
    start() {
        this.promise = func()
    }

    cancel() {
        this.promise.cancel()
    }

    render() { ... }
}
*/
export function cancellableAsync(asyncFunction) {
    return function(...args) {
        const that = this   // eslint-disable-line babel/no-invalid-this

        return new Promise((resolve, reject, onCancel) => {
            const ctx = { cancelled: false }
            onCancel(() => { ctx.cancelled = true })

            // 这里对 this 也进行了传递，以使此工具可以用于修饰 class method
            asyncFunction.call(that, ctx, ...args)
                .then(resolve, reject)
        })
    }
}
