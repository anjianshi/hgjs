import 'whatwg-fetch'
import { Promise } from 'promise'
import { queryString } from 'lang'
import { isPlainObject } from 'lodash'
import invariant from 'invariant'


/*
发起一个 AJAX 请求（实为对 Fetch API 的简单封装）
- 将 Fetch 返回的原生 Promise 转换为 Bluebird Promise（它的好处是支持 cancel() 操作）
- 扩展原 fetch() 函数 init 参数的 body 属性，若传入的是 plain object，会将其转换成 JSON 字符串
- 最终解析出的 response 对象增加一个 parsedBody 属性。response Content-Type 为 json 时，其为经过解析的 JSON 数据；否则为纯文本。
  这样就不用在接收到 response 对象后，再进行一次 promise then 操作来获取实际数据了。

= 关于“超时”与“超时重试”
早期的 makeRequest() 函数是基于 XHR 的。
那时不用 Fetch API 的一个重要原因，是它没有指定 timeout 和超时重试的功能。
也就是一个请求如果在若干时长内还没有完成，就判断为请求失败，重新发起请求或抛出异常。
但其实这样的机制没有必要。
之前的想法是，一个请求如果长时间没有完成，就说明网络有问题，那么重新连一次就有可能好转；或是不重新请求，直接报错，向用户告知网络连接不上。
但其实，如果是当前设备没有联网，请求通常一开始就会失败，并不会长时间挂着；长时间挂着要么是网络状况不好（如丢包严重），要么是服务器很忙，回复速度慢。
此时，重新发起请求一般只会让情况变得更差（一些之前已进行完毕的进程又要重新走一遍），而不会提前完成请求。
因此，超时重连功能是没用必要的。
那如果我们不想超时重连，只是想在超时时终止请求呢？
这我们首先要看，终止完请求后我们接下来想要做什么。如果终止请求后还是引导用户再按按钮发起一次请求，那和超时重连就没有什么区别。
如果是认为一个请求在超出一定时限后就没有必要执行了，因为这种情况很少，完全可以由发起请求的代码手动进行这一控制，而不必非得要求 AJAX 类库内建这一功能。
并且，其实我们可以把控制权交给用户，让用户在请求执行过程中有办法取消请求（包括点取消按钮、点返回上一页按钮等），这样如果用户等不及了，他就会自己去取消，如果他愿意等，那就让他一直等下去。
这样我们甚至都完全不用手动控制请求时长。

= 关于 cancel
Bluebird Promise 支持 cancel 操作，但此操作并不会真的结束 HTTP 请求（Fetch API 也不支持结束请求），
只会使 .then() 和 .catch() 回调不会被调用（.finally() 回调扔会被调用）。

之所以不想办法实现成真多结束请求，是因为这样的行为是没有保障的。
我们无法保证在我们想要结束请求时，后端是否已经接收到请求并开始处理，也无法保证我们断开连接后，后端会不会继续处理。
因此，干脆抛弃它。不然，它反而会干扰我们的决策，让我们以为执行了它就能让正在进行的操作被取消。
与其这样想，不如把我们的应用设计成即使操作没被取消也没问题。例如即使一个操作被重复执行了两次也不会出错。
*/
export function makeRequest(url, options=null) {
    options = {...options}

    if(!options.headers) options.headers = {}
    invariant(isPlainObject(options.headers), 'options.headers 只能是 plain object，不支持 Headers 等对象')

    if(isPlainObject(options.body)) {
        options.headers['Content-Type'] = 'application/json'
        options.body = JSON.stringify(options.body)
    }

    return new Promise((resolve, reject) => {
        window.fetch(url, options)
            // HTTP 请求完成，status 有可能是 200，也有可能是 404、500 等
            .then(response => {
                const contentType = response.headers.get('Content-Type') || ''
                const bodyPromise = contentType.startsWith('application/json') ? response.json() : response.text()
                bodyPromise.then(body => {
                    response.parsedBody = body
                    resolve(response)
                })

                // 不知为何，如果使用者把 bluebird Promise 设置为了 global Promise，那么这里只要不返回个值就会触发 bluebird 的 warning
                // http://bluebirdjs.com/docs/warning-explanations.html#warning-a-promise-was-created-in-a-handler-but-was-not-returned-from-it
                return null
            })
            // HTTP 请求未完成或在解析 parsedBody 时出错（例如 JSON 不合法）
            .catch(reject)
    })
}


/*
向 url 末尾添加 query string
url:  url 已经带上 query string 或没有带上均可
qs:   query string 内容。可以是字符串或对象（会被序列化为字符串）
*/
export function appendQS(url, qs) {
    if(typeof qs !== 'string') qs = queryString.stringify(qs)

    const sep = url.indexOf('?') < 0
        ? '?'
        : (url.endsWith('&') ? '' : '&')

    return url + sep + qs
}
