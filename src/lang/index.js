import { has, get, setWith, pickBy, isPlainObject, _flatMap } from 'lodash'
import invariant from 'invariant'

export * from './objectImmutable'
export * from './iterable'
export * from './browser'
export * from './money'
export * from './shallowEqual'
export * from './json'


export function setImmediate(callback) {
    if(window.setImmediate) {
        return window.setImmediate(callback)
    } else {
        return setTimeout(callback)
    }
}

export function clearImmediate(id) {
    if(window.clearImmediate) {
        return window.clearImmediate(id)
    } else {
        return clearTimeout(id)
    }
}

/**
 * 返回 obj 所有 property 的名字，包括从父类中继承而来的、以及 Nonenumerable 的。
 * @param  {object}         obj
 * @param  {function}       filter  对 property 进行过滤，此回调函数会接收到两个参数：property name 及 value，返回 true 的 property 会被保留下来。
 * @return {array[string]}
 */
export function getAllPropertyNames(obj, filter=null) {
    const names = []
    const prototype = Object.getPrototypeOf(obj)
    if(prototype) {
        names.push(...getAllPropertyNames(prototype, filter))
        Object.getOwnPropertyNames(prototype).forEach(name => {
            if(names.indexOf(name) === -1 && (filter === null || filter(name, prototype[name]))) {
                names.push(name)
            }
        })
    }
    return names
}

export function getAllMethodNames(obj, filter=null) {
    return getAllPropertyNames(
        obj,
        (name, value) => typeof value === 'function' && (filter === null || filter(name, value))
    );
}

// 在调用 lodash 的 _.set 时，lodash 会自动将之前不存在的节点创建出来。
// 一般情况下，lodash 会用一个 {} 来创建节点；可如果一个节点的名称是数字（包括数字、由数字组成的字符串），它就会用一个 array 来创建节点。
// 例如一个 key 是 3，那么会创建出一个长度为 4 的节点，但只有索引 3 有值，其他项都是 undefined。
// 这在进行遍历时可能会导致问题。
// 通过此函数，可以强制 lodash 用 {} 来创建节点
export function setWithObj(obj, path, value) {
    return setWith(obj, path, value, nsValue => nsValue || {})
}


/*
用来代替 lodash 自带的 flatMap。
那个 lodash 的 flatMap 无法正确处理 Set，而且在不同环境下行为好像还不一样：在浏览器里测试时会认为 Set 是 length 为 0 的数组；在 ReactNative 里则是会返回 Map( { value: value, value2: value2 } ) 的奇怪结果。
*/
export function flatMap(collection, ...args) {
    if(collection instanceof Set) collection = [...collection]
    return _flatMap(collection, ...args)
}

export function wrapArray(value) {
    return Array.isArray(value) ? value : [value];
}

export function hasValue(value) {
    return value !== null && value !== undefined;
}

// 把 object 中值为 undefined 的项移除，不直接修改原 object，而是返回一个新 object
// -----
// 原 object 中 key 为 Symbol 的内容也会被移入新 object（即使值为 undefined 也会被移入）
// 此行为依赖于 lodash 的 _.pickBy() 会把 Symbol 属性也传给回调的特点。
export function cleanObject(obj) {
    const symbolSet = new Set(Object.getOwnPropertySymbols(obj))
    return pickBy(obj, (value, key) => symbolSet.has(key) || value !== undefined)
}

/*
类似 lodash.pick，但支持在 pick 的同时，对部分键进行重命名
对于 obj 中不存在的键，不会将其 pick 到返回的对象中
例子：
const obj = {a: 1, b: 2, c: 3, d: 4, f: 5}
const picked = pickAs(obj, 'a', {b: 'x', c: 'y'}, 'notExist')
// {a: 1, x: 2, y: 3}

fromPath 和 toPath 都可以是 'a.b.c' 格式的 path 值，以实现深入提取
*/
export function pickAs(obj, ...props) {
    const picked = {}

    for(const prop of props) {
        if(isPlainObject(prop)) {
            for(const [from, to] of Object.entries(prop)) {
                _pickTo(obj, from, picked, to)
            }
        } else {
            _pickTo(obj, prop, picked, prop)
        }
    }

    return picked
}

function _pickTo(source, fromPath, target, toPath) {
    if(has(source, fromPath)) {
        setWithObj(target, toPath, get(source, fromPath))
    }
}


// 将 value 限制在 min、max 范围内
// 若 value 小于 min，返回 min；若 value 大于 max，返回 max；否则返回 value
export function limit(min, value, max) {
    invariant(min <= max, `min(${min})不应大于max(${max})`)
    return Math.min(Math.max(min, value), max)
}

// 确保 value >= floor
// 若 value 小于 floor，则返回 floor
export function notLessThen(value, floor) {
    return Math.max(value, floor)
}

// 确保 value <= ceil
// 若 value 大于 ceil，返回 ceil
export function notMoreThen(value, ceil) {
    return Math.min(value, ceil)
}
