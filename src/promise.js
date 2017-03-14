/*
对 bluebird 的 Promise 进行定制。

App 使用 Promise 时，建议从这里引入，而不是直接从 bluebird 处引入。
*/

import { Promise } from 'bluebird'


export { Promise }


Promise.config({
    warning: true,
    longStackTraces: true,
    cancellation: true
})


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
把 bluebird Promise 注入到全局作用域，代替运行环境自带的 Promise 实现
这样一来，使用 Promise 时就不用再引入此模块了，直接引用即可。

更重要的是，运行环境内置的一些功能，如 async await，也将改为使用 bluebird Promise。
这主要倒不是为了利用上 bluebird Promise 提供的功能，而是实现了接口上的统一。

例如某个工具（例如 hgjs/form），它接受 promise 作为参数，且总是假设这个 promise 有 bluebird Promise 提供的所有接口。
那么进行注入后，无论用户是传入一个手动创建的 bluebird Promise 还是传入 async await 获得的结果，它都能正常处理。
用户不用再费心关注每项操作返回的 Promise 类型，以及在各种 Promise 间进行转换。
*/
export function InjectToGlobal() {
    window.Promise = Promise
}
