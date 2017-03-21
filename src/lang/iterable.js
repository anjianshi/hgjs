/*
用于 iterable（array，Set...）类型的工具函数

- 以下大部分函数允许接收任何 iterable 值，包括 Set、Map、array、array-like 对象、iterable value

- 且大部分函数会根据第一个参数的类型，决定最终返回值的类型。若第一个参数是 Set，就会返回 Set；若是其他值，则统一返回 array。
  （大部分函数不会对 Map 做特别处理，例如返回 Map，而是会把它当做普通的 iterable value 来对待）
  个别函数的具体情况，见函数备注。
*/

import { findIndex, flatMap } from 'lodash'


// ========== 集合遍历类函数 ==========

// 返回 iterable 里指定 index 的内容
// 默认返回地一个元素；若 index 小于 0 或超出 iterable 长度，返回 undefined
export function iterGet(iter, index=0) {
    if(index < 0) return undefined

    let i = 0
    for(const value of iter) {
        if(i === index) {
            return value
        } else {
            i += 1
        }
    }
    return undefined
}

/*
返回 iterable 最前面的几个元素

若 num 小于等于 0，返回空数组
若 num 大于 iterable 的长度，仅返回 iterable 的所有内容
*/
export function iterTake(iter, num=0) {
    if(num <= 0) return []

    const taked = []
    for(const value of iter) {
        taked.push(value)
        if(taked.length === num) break
    }
    return taked
}

/*
返回 iterable 跳过开头几个内容后的结果
若 num 小于等于 0，返回整个 iterable 的内容；若 num 大于 iterable 长度，返回空数组
*/
export function iterSkip(iter, num=0) {
    let skippedNum = 0

    const taked = []
    for(const value of iter) {
        if(skippedNum < num) {
            skippedNum++
        } else {
            taked.push(value)
        }
    }
    return taked
}


// ========== 集合处理类函数 ==========
// 注意不要把以下函数 lodash 里名称类似的函数混淆


// 合并两个 iterable，排除重复了的值
export function union(iter1, iter2) {
    const s = new Set(iter1)
    for(const v of iter2) s.add(v)
    return iter1 instanceof Set ? s : [...s]
}

// 返回两个 iterable 中都存在的值
export function intersect(iter1, iter2) {
    const iter1set = toSet(iter1)
    const iter = []
    for(const v of iter2) {
        if(iter1set.has(v)) iter.push(v)
    }
    return iter1 instanceof Set ? new Set(iter) : iter
}

// 返回只在第一个 iterable 中存在的值
export function subtract(iter1, iter2) {
    const iter2set = toSet(iter2)
    const iter = []
    for(const v of iter1) {
        if(!iter2set.has(v)) iter.push(v)
    }
    return iter1 instanceof Set ? new Set(iter) : iter
}

// 判断 iter1 是不是 iter2 的子集
// 两个相同的集互为子集
export function isSubset(iter1, iter2) {
    const iter2set = toSet(iter2)
    for(const v of iter1) {
        if(!iter2set.has(v)) return false
    }
    return true
}

// 判断 iter1 是不是 iter2 的超集
// 两个相同的集互为超集
export function isSuperset(iter1, iter2) {
    return isSubset(iter2, iter1)
}

function toSet(iter) {
    return iter instanceof Set ? iter : new Set(iter)
}


// ========== 对象更新类函数 ==========
// 这些函数是用来补充 Array、Set、Map 自身缺乏的 immutable update 方法。


export function iterImmuAdd(iter, ...values) {
    if(iter instanceof Set) {
        iter = new Set(iter)
        for(const value of values) iter.add(value)
    } else {
        iter = [...iter, ...values]
    }
    return iter
}

/*
关于 predicate 参数：
若 iter 是 Set，其应为待删除的值；
若 iter 是 array 或其他 iterable 对象，其格式与在 iterImmuSplice() 里相同。

若通过 predicate 没有找出有效的 index，则没有内容会被删除。
iter 是数组时，指定的值被删除后，后面的值的索引都会前移。
*/
export function iterImmuDel(iter, predicate) {
    if(iter instanceof Set) {
        iter = new Set(iter)
        iter.delete(predicate)
    } else {
        iter = iterImmuSplice(iter, predicate, 1)
    }
    return iter
}

/*
向 iterable 里的指定位置插入一个或多个值。
对于 Set，此函数不会将结果转换为 Set，而是会把它当作普通的 iterable 处理。

注意，这里的参数是 pos 而不是 predicate。它的值必须是一个数字。

在执行插入后，原本处于指定位置及其之后的值的索引会后移。
*/
export function iterImmuInsert(iter, pos, ...values) {
    if(!(typeof pos === 'number')) throw Error('pos 必须是一个整数')
    return iterImmuSplice(iter, pos, 0, ...values)
}

/*
替换指定的值

若 iter 为 Set()，此操作等同于 iterImmuDel() + iterImmuAdd()，会将 predicate 值从 Set 里删除，并把 values 添加到 Set 末尾；
其他情况下，会根据 predicate 找出要替换的值的索引。若通过 predicate 没有找出有效的 index，则将值全部添加到 iter 的末尾。
*/
export function iterImmuReplace(iter, predicate, ...values) {
    if(iter instanceof Set) {
        iter = new Set(iter)
        iter.delete(predicate)
        for(const value of values) iter.add(value)
    } else {
        iter = iterImmuSplice(iter, predicate, 1, ...values)
    }
    return iter
}

/*
对任意 iterable 类型执行 splice 操作

predicate 有两种可选值：
- number                直接指定待删除的值的索引
- object / function     它会被传给 lodash.findIndex()，用来找出目标索引，然后删除它
*/
export function iterImmuSplice(iter, predicate, deleteCount, ...values) {
    iter = [...iter]
    iter.splice(predicate2index(iter, predicate), deleteCount, ...values)
    return iter
}

function predicate2index(array, predicate) {
    let index = typeof predicate === 'number' ? predicate : findIndex(array, predicate)
    if(index === -1) index = array.length
    return index
}


export function unionMap(...maps) {
    const entries = flatMap(maps, map => Array.from(map.entries()))
    return new Map(entries)
}

export function mapImmuSet(iter, key, value) {
    const m = new Map(iter)
    m.set(key, value)
    return m
}

export function mapImmuDel(iter, key) {
    const m = new Map(iter)
    m.delete(key)
    return m
}
