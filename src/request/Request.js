/**
 * AJAX Library
 * - 参考 qwest，精简了一些功能，也不再支持那么多浏览器，并修正了一些不符合要求的行为，且代码统一以 ES6 的形式进行重写
 * - request data type 支持 query string (GET 请求)、JSON 和 form-data (用于上传文件)
 * - response Content-Type 为 json 时，自动对返回值进行解析；否则把返回值当作纯文本来处理
 * - 支持 timeout 和超时重试
 * - 不支持跨域 / JSONP；不支持 sync 请求
 * - 浏览器支持到 IE11
 *
 * 一般情况下不应直接使用此库，而应该使用封装了更多细节的 API()
 *
 * XMLHTTPRequest 相关资料：
 * https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest
 * https://developer.mozilla.org/en-US/docs/AJAX/Getting_Started
 * https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/Using_XMLHttpRequest
 * http://www.w3.org/TR/2012/WD-XMLHttpRequest-20120117/#event-xhr-load
 */

// TODO 支持 IE 9

import jparam from 'jquery-param'
import { Promise } from './promise'
import { get } from 'lodash'

export class Request {
    /**
     * options:
     *     method       默认为 GET
     *     data         若 method 为 GET，data 会被拼装成 query string 附加到 url 后面
     *     headers      额外的请求头
     *
     *     timeout      请求的超时时间(ms)，默认为 30000
     *     attempts     若请求超时，尝试重新发起请求的次数（1 代表不重试，2 代表重试1次，以此类推）
     *
     *     preprocessor     (xhr) => {}         可以通过此回调，在请求正式发送前，对 xhr 对象进行一些处理。
     *     success          (resp, xhr) => {}   请求成功时的回调，也可以在对象创建后，调用 onSuccess 进行注册（以下 error 和 complete 也一样）
     *     error            (resp, xhr) => {}   请求出现错误或超时时会调用此回调，用户手动 abort() 不会触发此回调。
     *     complete         (resp, xhr) => {}   请求以任何形式结束时，都会调用此回调。（包括用户手动执行 abort() 结束的情况，以便调用者进行一些收尾操作）
     *                                          注意：complete 有可能在 success / error 之前也有可能在之后被调用，因此不要写出依赖于它们的调用顺序的代码。
     */
    constructor(url, options) {
        // 请求 success / error / abort 后，此属性的值会被设为 true。
        // 此时将不允许再注册回调函数，因为注册了也不会被调用（此对象不会缓存请求的结果并把它传给请求结束后才注册进来的回调）
        this.completedStatus = null;
        this.response = undefined;

        // HTTP 参数
        this.method = options.method ? options.method.toUpperCase() : 'GET';
        this.url = url;
        this.data = null;

        this.headers = Object.assign({
            'Cache-Control': 'no-cache'     // 屏蔽浏览器缓存
        }, options.headers || {});

        this._prepareData(options.data);

        // Timeout
        this.timeout = get(options, 'timeout', 30000);
        this.attempts = get(options, 'attempts', 1);
        this._intervalId = null;
        this._abortByTimeout = null;

        this._alreadyAttempts = 1;

        // Callbacks
        this.preprocessor = options.preprocessor;

        this._callbacks = {
            success: [],
            error: [],
            complete: []
        };

        ['success', 'error', 'complete'].forEach((eventType) => {
            if(options[eventType]) {
                const callback = options[eventType];
                this._registerCallback(eventType, callback);
            }
        });

        // 初始化 XHR 对象
        this.xhr = new XMLHttpRequest();
        this.xhr.addEventListener('load', this._handleLoad.bind(this));
        this.xhr.addEventListener('error', this._handleError.bind(this));
        this.xhr.addEventListener('abort', this._handleAbort.bind(this));
        // 这个不能放在 _send() 中，只能放在这里。因为 watch 只需要一次，但当连接超时重试时，_send() 会被调用好几次。
        this._watchForTimeout();

        this._send();
    }

    // ===== public methods =====

    onSuccess(callback) { this._registerCallback('success', callback); return this }
    onError(callback) { this._registerCallback('error', callback); return this }
    onComplete(callback) { this._registerCallback('complete', callback); return this }

    // 清除已注册的所有回调，用来平滑地终止请求。
    // 即：并不终止请求，但使得请求完成时，不会有任何回调被调用
    clearCallbacks() {
        Object.keys(this._callbacks).forEach(type => {
            this._callbacks[type] = []
        })
    }

    // 中止请求。和直接调用 this.xhr.abort() 效果一样。
    abort() {
        if(this.completedStatus) { return; }
        this.xhr.abort();
    }

    promise() {
        if(!this._promise) {
            this._promise = new Promise((resolve, reject, onCancel) => {
                this.onSuccess(resp => resolve(resp))
                this.onError(resp => reject(new Error(resp)))
                onCancel(() => this.abort())
            })
        }
        return this._promise
    }

    // ===== internal =====
    // 请勿手动调用下面的方法，否则可能导致未知的问题。

    _prepareData(data) {
        if(data) {
            if(this.method === 'GET') {
                this.url += (/\?/.test(this.url) ? '&' : '?') + jparam(data);
            } else if((window.FormData && data instanceof window.FormData)
                    || (window.ArrayBuffer && data instanceof ArrayBuffer)) {
                this.data = data
            } else {
                this.headers['Content-Type'] = 'application/json';
                this.data = JSON.stringify(data);
            }
        }
    }

    _getParsedResponse() {
        if(this.response === undefined) {
            if(this.xhr.status === 0) { // 说明当前请求是以 abort 的方式结束的
                this.response = null
            } else {
                // 在 IE9 中，xhr 对象没有 response 属性。
                const rawResponse = typeof this.xhr.response !== 'undefined' ? this.xhr.response : this.xhr.responseText
                this.response = this.xhr.getResponseHeader('Content-Type').startsWith('application/json')
                    ? JSON.parse(rawResponse)
                    : rawResponse
            }
        }
        return this.response;
    }

    _registerCallback(eventType, callback) {
        // 若请求已经完成，直接调用回调（在 eventType 和结束方式相同的情况下），否则把它注册进队列
        if(this.completedStatus) {
            if(eventType === 'complete' || eventType === this.completedStatus) {
                callback(this.response, this.xhr);
            }
        } else {
            this._callbacks[eventType].push(callback);
        }
    }

    _triggerCallback(eventType) {
        const [resp, xhr] = [this._getParsedResponse(), this.xhr];
        this._callbacks[eventType].forEach((callback) => callback(resp, xhr));
    }

    // 发送请求。
    // 若指定了 timeout 和 attempts，当请求超时时会再次调用此方法重新发起请求。
    _send() {
        if(this.completedStatus) { return; }

        // 部分操作（如指定 header）必须 open 后才能进行。
        // 这些必须在 open 后才能执行的操作每次 open 后（例如因超时而进行重连）都要重新执行（像绑定事件回调就不用，因为它是在 open 前就能进行的）。
        this.xhr.open(this.method, this.url);

        Object.keys(this.headers).forEach(name => this.xhr.setRequestHeader(name, this.headers[name]));

        if(this.preprocessor) {
            this.preprocessor(this.xhr);
        }

        this.xhr.send(this.data);
    }

    // 检查连接是否超时
    _watchForTimeout() {
        if(this.timeout) {
            this._intervalId = setInterval(() => this._handleTimeout(), this.timeout);
        }
    }

    // 处理连接超时的情况
    _handleTimeout() {
        this._abortByTimeout = true;
        this.xhr.abort();

        if(this._alreadyAttempts < this.attempts) {
            // 尝试重新发起请求
            this._alreadyAttempts++;
            this._send();
        } else {
            // 已达到重试次数，不再重新发起请求，以 error 的形式结束。
            this._complete('error');
        }
    }

    _handleLoad() {
        // 对浏览器来说，只有在网络层面上出错时，才会调用 onerror 回调；只要请求完成了，哪怕返回的是 500 / 400 这样的 status，也会调用 onload 而不是 onerror。
        // 因此，需要在这手动判断，选择要触发使用者注册进来的哪种回调。
        this._complete(this.xhr.status === 200 ? 'success' : 'error');
    }

    _handleError() { this._complete('error'); }

    _handleAbort() {
        // 连接被 abort 有三种情况：
        // 1. 使用者手动执行 abort() 操作
        // 2. 请求超时，但之后还要进行重试
        // 3. 请求超时且已达到重试次数，以报错的形式结束请求
        // 其中第2,3种情况由 timeout handler 自行处理，而对第一种情况，由当前方法执行收尾
        if(this._abortByTimeout) {
            this._abortByTimeout = null;
        } else {
            this._complete('abort');
        }
    }

    // 触发回调，并进行收尾工作
    _complete(status) {
        this.completedStatus = status;

        clearInterval(this._intervalId);
        this._intervalId = null;

        if(status !== 'abort') {
            this._triggerCallback(status);
        }
        this._triggerCallback('complete');
    }
}

/**
 * 当 requests 全部以 success 的状态完成响应后，调用回调函数
 * 只要有任意一个 request 出现 error，则 callback 不会被调用，且其余尚未完成的 request 都会被 abort()
 */
Request.all = function(requests, callback) {
    const responses = [];
    let responsed = 0;

    requests.forEach(function(request, i) {
        request.onSuccess((resp) => {
            responses[i] = resp;
            responsed++;
            if(responsed === requests.length) {
                callback(...responses);
            }
        });

        request.onError(() => {
            requests.forEach((request) => request.abort());
        });
    });
};
