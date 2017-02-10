/**
AJAX Library
- 参考 qwest，精简了一些功能，也不再支持那么多浏览器，并修正了一些不符合要求的行为，且代码统一以 ES6 的形式进行重写
- request data type 支持 query string (GET 请求)、JSON 和 form-data (用于上传文件)
- response Content-Type 为 json 时，自动对返回值进行解析；否则把返回值当作纯文本来处理
- 支持 timeout 和超时重试
- 不支持跨域 / JSONP；不支持 sync 请求
- 浏览器支持到 IE11（主要是 IE9 不支持 FormData；对于 IE10 现在其实并没有看到用到哪些它不支持的功能，所以其实可能也是支持的）

XMLHTTPRequest 相关资料：
https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest
https://developer.mozilla.org/en-US/docs/AJAX/Getting_Started
https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/Using_XMLHttpRequest
http://www.w3.org/TR/2012/WD-XMLHttpRequest-20120117/#event-xhr-load
*/

import jparam from 'jquery-param'
import { Promise } from 'promise'
import { get } from 'lodash'


/*
options:
    method       默认为 GET
    data         若 method 为 GET，data 会被拼装成 query string 附加到 url 后面
    headers      额外的请求头

    timeout      请求的超时时间(ms)，默认为 30000
    attempts     若出现请求超时的情况，总共允许执行几次请求（即是否允许重试。1 代表不重试，2 代表重试1次，以此类推）

    preprocessor     (xhr) => {}         可以通过此回调，在请求正式发送前，对 xhr 对象进行一些处理。

此函数返回一个 bluebird Promise，
- 若请求成功，它会以 resolved 的形式结束，返回 response 数据；
- 若请求出现错误或超时，它会以 rejected 的形式结束，返回 RequestError 错误；
- 通过 promise.finally(fn) 可以指定一个在 resolved 或 rejected 状态下皆会被调用的回调。它可以用来进行一些收尾工作。
- 通过 promise.cancel() 方法可以手动终止请求，这种情况下，then() 或 catch() 回调都不会被调用，但 finally() 回调仍会被调用。
*/
export function makeRequest(url, options={}) {
    const opt = formatOptions(url, options)

    let resolve, reject, onCancel
    const promise = new Promise((_resolve, _reject, _onCancel) => {
        resolve = _resolve
        reject = _reject
        onCancel = _onCancel
    })

    const xhr = new XMLHttpRequest()

    // 只要请求成功结束，即使 status code 不是 200，浏览器也会认为是成功结束；但对我们来说，应该将它视为请求失败
    xhr.addEventListener('load', () => complete(xhr.status === 200 ? 'success' : 'error'))
    xhr.addEventListener('error', () => complete('error'))
    // 这里没有注册 abort 事件的回调。abort 的后续行为皆由执行 abort 的那个地方自行处理。

    // 发送请求。若指定了 timeout 和 attempts，当请求超时时会再次调用此方法重新发起请求。
    function send() {
        xhr.open(opt.method, opt.url)
        for(const [name, value] of Object.entries(opt.headers)) xhr.setRequestHeader(name, value)
        if(opt.preprocessor) opt.preprocessor(xhr)
        xhr.send(opt.data)
    }

    function complete(status) {
        const response = parseResponse(xhr)
        if(status === 'success') {
            resolve(response)
        } else if(status === 'error') {
            reject(new RequestError(xhr, response))
        }
    }

    onCancel(() => xhr.abort())

    if(opt.timeout) {
        var alreadyAttempts = 1
        const intervalId = setInterval(() => {
            xhr.abort()

            if(alreadyAttempts < opt.attempts) {
                // 尝试重新发起请求
                alreadyAttempts++
                send()
            } else {
                // 已达到重试次数，不再重新发起请求，以 error 的形式结束。
                complete('error');
            }
        }, opt.timeout)
        promise.catch(() => {}).finally(() => clearInterval(intervalId))
    }

    send()

    return promise
}

function formatOptions(url, raw) {
    const opt = {
        url,
        method: raw.method ? raw.method.toUpperCase() : 'GET',
        headers: {...raw.headers},
        data: null,

        timeout: get(raw, 'timeout', 30000),
        attempts: get(raw, 'attempts', 1),

        preprocessor: raw.preprocessor
    }

    if(raw.data) {
        if(opt.method === 'GET') {
            url += (/\?/.test(url) ? '&' : '?') + jparam(raw.data)
        } else if((window.FormData && raw.data instanceof window.FormData)
                || (window.ArrayBuffer && raw.data instanceof ArrayBuffer)) {
            opt.data = raw.data
        } else {
            opt.headers['Content-Type'] = 'application/json'
            opt.data = JSON.stringify(raw.data)
        }
    }

    return opt
}

function parseResponse(xhr) {
    if(xhr.status === 0) {  // 说明请求是以 abort 的方式结束的
        return null
    } else {
        // 在 IE9 中，xhr 对象没有 response 属性。
        const rawResp = typeof xhr.response !== 'undefined' ? xhr.response : xhr.responseText
        return xhr.getResponseHeader('Content-Type').startsWith('application/json')
            ? JSON.parse(rawResp)
            : rawResp
    }
}

// 自定义 Error 类的方法来自： http://stackoverflow.com/a/871646/2815178
function RequestError(xhr, response) {
    this.xhr = xhr
    this.response = response
}
RequestError.prototype = Error.prototype
