/*
对 bluebird 的 Promise 进行定制。

App 使用 Promise 时，建议从这里引入，而不是直接从 bluebird 处引入。
*/

import { Promise } from 'bluebird'
export { Promise }


function initPromiseLib(Promise) {
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

    /* 生成一个新的、独立的 Promise 类，并对其进行初始化 */
    Promise.getNewInitedLibraryCopy = function() {
        const NewPromise = Promise.getNewLibraryCopy()
        initPromiseLib(NewPromise)
        return NewPromise
    }
}

initPromiseLib(Promise)
