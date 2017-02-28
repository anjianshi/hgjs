import { isFunction, clone as cloneObj, has, size, isPlainObject } from 'lodash'

/*
对 plain object 进行 immutable update 的工具。

为什么要进行 immutable update 而不是直接修改 object？
因为 React 的 shallowEqual 的特点是只根据引用判断两个对象是否相同，因此每当要更新对象时，必须重新生成一个对象，而不能直接修改原来的对象。
而从头重新生成一个 object 要遍历它的所有子节点，速度太低，比较好的方式是只重新生成变化了的部分，没变化的部分直接从原来的对象链接到新对象，这就是 immutable update。
除了性能提升，这种方式也保证了没有变化的部分的引用不会变，所以单独把它们传给某个 component 时，shallowEqual 不会认为它们变化了而重新渲染。

它们的效果，以 immuSet() 为例:
const o1 = {
    a: { c: 1, d: 2 },
    b: { e: 3 }
}
const o2 = immuSet(o1, ['a', 'd'], 4)

此操作等同于：
const o2 = {
    ...o1,
    a: {
        ...o1.a,
        d: 4
    },
}
即：
o2.a.c === o1.a.c
o2.b === o1.b

以下各工具的测试用例见 test/lang/immutable.js
*/


/*
设置 obj 中指定节点的值。
如果节点所处的路径在 obj 中尚不存在，会自动创建出来。

value
value(value): updatedValue    可以是一个数值，也可以是一个用来执行修改的回调函数

makeNode(parent, key): node   调用此回调来创建路径节点。若未提供此回调或调用后返回值为空，则使用默认行为：创建出一个 object。
                              parent：节点将会被添加到的容器； key：节点在容器中的 key
                              此回调不用对 parent 进行操作，只需将生成的节点对象返回即可。


范例：
immuSet(obj, ['a', 'b', 'c'], 100)
immuSet(obj, ['a', 'b', 'c'], prevValue => prevValue * 2)

immuSet(obj, ['a', 'b'], value =>
    ({ ...value, x: 1, y: 2 })  // 更新 value object 中的某些 props。这一更新本身也是一次 immutable update
)

自动创建不存在的路径
immuSet({}, ['a', 'b'], 1)    // {a: {b: 1}}

const makeNode = () => ({ [specialSymbol]: true })
immuSet({}, ['a', 'b'], 1, makeNode)        // { a: { [specialSymbol]: true, b: 1 } }

此函数其实可以用： obj = {...obj, a: 1, b: 2} 代替，不过在修改深层节点时，此函数要更方便一些
*/
export function immuSet(obj, path, value, makeNode=null) {
    checkArg(obj, path)

    if(!path.length) {
        return obj
    }

    const setter = isFunction(value) ? value : (() => value)
    return baseImmuSet(obj, path, setter, makeNode)
}

/*
一次性执行多条 immuSet 操作。
updates 格式：
[
    [path, value, makeNode (optional)],
    ...
]
*/
export function batchImmuSet(obj, updates) {
    return updates.reduce(
        (obj, [path, value, makeNode]) => immuSet(obj, path, value, makeNode),
        obj
    )
}

function baseImmuSet(obj, path, setter, makeNode) {
    const [key, ...restPath] = path
    const clone = cloneObj(obj)
    clone[key] = !restPath.length
        ? setter(clone[key])
        : baseImmuSet(
            key in clone ? clone[key] : (makeNode && makeNode(clone, key)) || {},
            restPath, setter, makeNode)
    return clone
}

/*
移除 obj 中的指定节点。若节点不存在，原样返回 obj。

若 withEmptyParent 为 true，则如果目标节点移除后，父节点为空，会将父节点一并移除（此行为会一直向上递归，直到遇到根节点）。
例如：
const obj = {a: {b: {c: 1}}}
immuDel(obj, ['a', 'b', 'c'], true)     // 返回 {}
若要在删除空的父元素时，确保最顶上的几级不被删除，可以像这样：
{
    ...obj,
    a: immuDel(obj.a, ['b', 'c'], true)
}
或者：
immuSet(obj, ['a'], sub => immuDel(sub, ['b', 'c'], true))
均会返回 {a: {}}

父节点中 key 为 Symbol 的属性会被忽略，就是说如果父节点中只剩下 key 为 Symbol 的属性，那么它会被认为是空的。
此行为依赖于 lodash 的 _.size() 计数时会忽略 Symbol 属性的特点。

obj 是一个数组时也是通过 delete 运算符进行删除，不会利用 array.splice() 对数组进行重新排布
这也意味着，在删除元素后，数组的 length 不会变化，进而也不会触发 withEmptyParent 删除机制
*/
export function immuDel(obj, path, withEmptyParent=false) {
    checkArg(obj, path)
    if(path.length && has(obj, path)) {
        return baseImmuDel(obj, path, withEmptyParent)
            || baseImmuDel(obj, [path[0]])
    } else {
        return obj
    }
}

function baseImmuDel(obj, path, withEmptyParent) {
    const [key, ...restPath] = path

    let noRest = restPath.length === 0  // 是否没有后续节点了
    let restResult                      // 后续节点的处理结果

    if(!noRest) {
        restResult = baseImmuDel(obj[key], restPath, withEmptyParent)
        if(restResult === undefined) {
            noRest = true
        }
    }

    if(noRest && withEmptyParent && size(obj) === 1) {
        return undefined    // 返回 undefined 即告诉上级，父节点也应被删除
    } else {
        const clone = cloneObj(obj)
        if(noRest) {
            delete clone[key]
        } else {
            clone[key] = restResult
        }
        return clone
    }
}

function checkArg(obj, path) {
    if(!isPlainObject(obj) && !Array.isArray(obj)) throw new Error(`immutable update 的 obj 参数必须是 plain object 或 array, got: ${obj}`)
    if(!Array.isArray(path)) throw new Error(`immutable update 的 path 参数必须是一个数组, got: ${path}`)
}

// import "test/lang/immutable.js"
