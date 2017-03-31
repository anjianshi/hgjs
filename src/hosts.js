import invariant from 'invariant'


/*
通过此工具可以管理一个页面或模块中发起的多个 promise，当离开页面或终止模块运行时，对尚未完成的 promise 统一进行 cancel，
以免在页面 / 模块已经不存在的情况下触发了 promise 的后续操作，导致数据混乱。

接口：

makePromiseHost(): hostPromiseFunc

hostPromise(promise)
    托管一个 promise

hostPromise(func, ...args)
    把 args 传给 func，并托管 func 返回的 promise
    若 func 返回的不是一个 promise，会报错

    只支持 bluebird promise，因为只有它支持 cancel。

hostPromise.clear()
    对之前传给 hostPromise() 的所有尚未完成的 promise 进行 cancel
*/
export function makePromiseHost() {
    let promises = []

    /*
    托管一个 promise。
        this.hostPromise(promise)
    或
        this.hostPromise(func, ...args)
        args 会被传给 func，并对 func 返回的 promise 进行托管
        若 func 返回的不是一个 promise，会报错

    只支持 bluebird promise，因为只有它支持 cancel。
    */
    function hostPromise(target, ...args) {
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
    hostPromise.clear = clear

    return hostPromise
}



/*
和 makePromiseHost 类似，不过是对 setTimeout 和 setInterval 进行托管，
当使用者决定停止运行时，可一次性将尚未触发 / 终止的 timeout 和 interval 全部取消。

此工具还额外提供了一个 setDelayInterval() 函数，可以用来控制 setInterval(fn) 里的 fn 第一次被执行的时间。
在完成第一次执行后，才开始根据 interval 安排下次运行。
它可以用来延迟第一次执行的时间（相当于 setTimeout + setInterval）；也可以用于提早第一次运行的时间。
例如将 delay 设置为 0 即可实现立即执行一次，然后再安排 interval

格式： setDelayInterval(fn, interval, delay)


makeTimerHost() 使用范例：
const host = makeTimerHost()

host.setTimeout(...)
host.setInterval(...)

...

host.clear()
*/
export function makeTimerHost() {
    let timeouts = []
    let intervals = []

    function hostedSetTimeout(...args) {
        const id = setTimeout(...args)
        timeouts.push(id)
        return id
    }

    function hostedSetInterval(...args) {
        const id = setInterval(...args)
        intervals.push(id)
        return id
    }

    function hostedSetDelayInterval(fn, interval, delay, ...args) {
        // 注意：这里返回的是 timeout 的 id，当第一次执行完成后，后面的 interval 没法通过这个 id 来取消
        return hostedSetTimeout(() => {
            fn()
            hostedSetInterval(fn, interval, ...args)
        }, delay, ...args)
    }

    function clear() {
        for(const id of timeouts) clearTimeout(id)
        timeouts = []

        for(const id of intervals) clearInterval(id)
        intervals = []
    }

    return {
        setTimeout: hostedSetTimeout,
        setInterval: hostedSetInterval,
        setDelayInterval: hostedSetDelayInterval,
        clear
    }
}
