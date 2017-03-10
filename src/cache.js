/* eslint-env browser */

import { exToJSON, exParseJSON } from 'lang'

/*
缓存 app 数据（例如 view component 的 state）以便以后使用（例如在 component unmount 后重新 mount 时，取回之前的 state）。
数据为单次取出，即在取出后，就会把数据从 cache 中清除。

cache 中的数据存储在内存里，性能更好，且允许存入不可序列化的数据（例如 Promise 对象）
persistCache 里的数据即使关闭浏览器再打开也依然有效，但里面的数据必须能够 JSON 化。
（使用了经扩展的 JSON 函数，支持处理 Map 和 Set 类型）

随着 app 代码的更新，之前存入的 persist cache 可能会不符合新代码里所需的格式，并导致不可预知的问题。
可以通过指定 keyPrefix，并在每次 persist cache 格式变化时更改 prefix，来解决此问题（因为这样一来，之前存入的 cache 就都不会被读取到了）
例如：一开始设置成 '_hgjs_persist_v1'，发生变化后就改成 '_hgjs_persist_v2'，以此类推。
*/

export const cache = {
    _cached: {},

    has(key) {
        return key in cache._cached
    },

    set(key, data) {
        cache._cached[key] = data
    },

    get(key) {
        if(!cache.has(key)) return undefined

        const data = cache._cached[key]
        delete cache._cached[key]
        return data
    }
}


export const persistCache = {
    keyPrefix: '_hgjs_persist_',

    has(key) {
        key = persistCache.keyPrefix + key
        return key in localStorage
    },

    set(key, data) {
        key = persistCache.keyPrefix + key
        data = exToJSON(data)
        localStorage[key] = data
    },

    get(key) {
        if(!persistCache.has(key)) return undefined

        const data = exParseJSON(localStorage[key])
        delete localStorage[key]
        return data
    }
}
