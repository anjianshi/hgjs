import { toPairs } from 'lodash'

/*
Scope Struct
用来存放多层级的 data，data 可以是包括 object 在内的任意类型。
通过 scopeSymbol 来区分 scope object 和实际的数据 object，以避免将它们弄混。

最高层级因为一定是 scope object，所以不需要 scopeSymbol。

{
    key: data,
    key: {
        dataKey: data,
        ...
    },
    scope: {
        [scopeSymbol]: true,
        key: data,
        scope: {
            [scopeSymbol]: true,
            key: data
        }
    }
}
*/

// 为保证 form state 能进行持久化（转化成 JSON），不使用 Symbol 对象
export const scopeSymbol = '_scope'

// 判断 scope struct 中的一个节点是 scope 还是 data
const isScope = item => item && item[scopeSymbol]

/*
遍历 scope struct 数据，将其中的每一项 item 传给回调
此函数会递归深入所有 scope

callback(item, path: array): undefined|false
可以通过返回 false 来停止遍历

若因 callback 返回 false 而提前停止遍历，此函数也会返回 false；否则返回 undefined
*/
export function scopeForEach(scope, callback, _superScopes=[]) {
    // 通过这样的设计，使得下层的 scopeForEach 中的 callback 返回 false 时，当前层（以及更上层）的遍历也能跟着立即结束
    for(const [name, item] of toPairs(scope)) {
        // 因为 scopeSymbol 不是真正的 symbol，在遍历 scope 时它会被遍历出来，应将其跳过
        if(name === scopeSymbol) continue

        const path = [..._superScopes, name]
        const result = isScope(item)
            ? scopeForEach(item, callback, path)
            : callback(item, path)
        if(result === false) {
            return false
        }
    }
}
