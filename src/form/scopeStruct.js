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

// 为保证 form state 能进行持久化（转换成 JSON），不使用 Symbol 对象
export const scopeSymbol = '_scope'

// 判断 scope struct 中的一个节点是 scope 还是 data
const isScope = item => item && item[scopeSymbol]

/*
生成一个 iterator，递归遍历 scope stract 中的每一个 item
返回的单项数据格式： { item, path }
*/
export function* scopeItems(scope, _superScopes=[]) {
    for(const [name, item] of toPairs(scope)) {
        // 因为 scopeSymbol 不是真正的 symbol，在遍历 scope 时它会被遍历出来，应将其跳过
        if(name === scopeSymbol) continue

        const path = [..._superScopes, name]
        if(isScope(item)) {
            yield* scopeItems(item, path)
        } else {
            yield [item, path]
        }
    }
}
