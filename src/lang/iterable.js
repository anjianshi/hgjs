// 用于 iterable（array，Set...）类型的工具函数
// -----
// 1. 注意不要把以下函数 lodash 里名称类似的函数混淆
// 2. 以下所有函数都不会修改原 Set / iterable，而是会返回新 Set

// 将两个 iterable 合并成一个新 Set
export function union(iter1, iter2) {
    const s = new Set(iter1)
    for(const v of iter2) s.add(v)
    return s
}

// 返回两个 iterable 中都存在的值
export function intersect(iter1, iter2) {
    iter2 = iter2 instanceof Set ? iter2 : new Set(iter2)
    const s = new Set()
    for(const v of iter1) {
        if(iter2.has(v)) {
            s.add(v)
        }
    }
    return s
}

// 返回只在第一个 iterable 中存在的值
export function subtract(iter1, iter2) {
    iter2 = iter2 instanceof Set ? iter2 : new Set(iter2)
    const s = new Set()
    for(const v of iter1) {
        if(!iter2.has(v)) {
            s.add(v)
        }
    }
    return s
}

// 判断 iter1 是不是 iter2 的子集
export function isSubset(iter1, iter2) {
    iter2 = iter2 instanceof Set ? iter2 : new Set(iter2)
    for(const v of iter1) {
        if(!iter2.has(v)) return false
    }
    return true
}

// 判断 iter1 是不是 iter2 的超集
export function isSuperset(iter1, iter2) {
    return isSubset(iter2, iter1)
}

// 两个相同的集互为超集和子集


// 分别用于 Set 和 Map 的 immutable updates 函数。
// 用它们来弥补 Set / Map 所有操作方法都直接更新自身的不足

export function setImmuAdd(iter, value) {
    const s = new Set(iter)
    s.add(value)
    return s
}

export function setImmuDel(iter, value) {
    const s = new Set(iter)
    s.delete(value)
    return s
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
