import { immuSet, batchImmuSet, immuDel } from './immutable'

let i = 1
function test(a, b, equal=true) {
    if(equal ? a === b : a !== b) {
        console.log(i, true)
    } else {
        console.log(i, false, a, b, equal ? 'should equal' : 'should not equal')
    }
    i++
}

const obj = {
    a: {
        aa: {
            aaa: { aaaa: 100 }
        },
        ab: {
            aba: 200
        }
    },
    b: {
        ba: 'abc'
    }
}

const arr = [
    { a: 1 },
    { b: [1, 2, {c: 3}] }
]

// ===== immuSet =====

// 修改值
const t1 = immuSet(obj, ['a', 'aa', 'aaa', 'aaaa'], 200)
const t2 = immuSet(obj, ['a', 'aa', 'aaa', 'aaaa'], value => value + 100);
[t1, t2].forEach(t => {
    // 由 aaaa 不相等可以确定 aaa、aa、a 和顶层肯定都不相等
    test(t.a.aa.aaa.aaaa, 200)
    test(obj.a.aa.aaa.aaaa, 100)

    test(t.a.ab, obj.a.ab)
    test(t.b, obj.b)
})

const t8 = immuSet(arr, [1, 'b', 1], 100)
test(t8[1].b[1], 100)
test(arr[1].b[1], 2)
test(t8[1].b[2].c, 3)
test(t8[1].b[2], arr[1].b[2])
test(t8[0].a, 1)
test(t8[0], arr[0])

// 新增属性
const t3 = immuSet(obj, ['a', 'aa', 'aab', 'aac'], 200)
test(t3.a.aa.aab.aac, 200)
test(obj.a.aa.aab, undefined)
test(t3.a.aa.aaa, obj.a.aa.aaa)
test(t3.a.aa, obj.a.aa, false)  // 由此可确定 t3.a 肯定也不等于 obj.a
test(t3.ab, obj.ab)
test(t3.b, obj.b)

const t9 = immuSet(arr, [1, 'b', 3], 4)
test(t9[1].b[3], 4)
test(arr[1].b[3], undefined)
test(t9[1].b[0], 1)
test(t9[0].a, 1)
test(t9[0], arr[0])

// 如果指定的 path 不存在，会自动创建
const t5 = immuSet(obj, ['a', 'aa', 'aab', 'aaba'], 300)
test(t5.a.aa.aab.aaba, 300)
test(obj.a.aa.aab, undefined)
test(t5.a.aa.aaa, obj.a.aa.aaa)
test(t5.a.aa, obj.a.aa, false)
test(t3.ab, obj.ab)
test(t5.b, obj.b)

const symbol = Symbol('node')
const makeNode = (parent, key) => ({ [symbol]: [parent, key] })
const t13 = immuSet(obj, ['b', 'bb', 'bba', 'bbaa'], 100, makeNode)
test(t13.b.bb.bba.bbaa, 100)
test(t13.b.bb.bba[symbol][0], t13.b.bb)
test(t13.b.bb.bba[symbol][1], 'bba')
test(t13.b.bb[symbol][0], t13.b)
test(t13.b.bb[symbol][1], 'bb')
test(t13.b[symbol], undefined)
test(obj.b.bb, undefined)


// ===== batchImmuSet =====
const t14 = batchImmuSet(obj, [
    [['a', 'aa', 'aaa', 'aaab'], 300],
    [['a', 'aa', 'aab'], 400]
])
test(t14.a.aa.aaa.aaab, 300)
test(t14.a.aa.aab, 400)
test(t14.a.aa.aaa.aaaa, 100)
test(t14.a.ab.aba, 200)
test(t14.b.ba, 'abc')
test(obj.a.aa.aaa.aaab, undefined)
test(obj.a.aa.aab, undefined)
test(t14.b, obj.b)
test(t14.ab, obj.ab)


// ===== immuDel =====
const t7 = immuDel(obj, ['a', 'ab'])
test(t7.a.ab, undefined)
test(obj.a.ab.aba, 200)
test(t7.a.aa, obj.a.aa)
test(t7.b, obj.b)

const t10 = immuDel(arr, [1, 'b', 1])
test(t10[1].b[1], undefined)
test(arr[1].b[1], 2)
test(t10[1].b[2].c, 3)
test(t10[1].b[2], arr[1].b[2])
test(t10[0].a, 1)
test(t10[0], arr[0])

const t12 = immuDel(obj, ['a', 'aa', 'aaa', 'aaaa'], true)
test(t12.a.aa, undefined)
test(t12.a.ab.aba, 200)
test(t12.a.ab.aba, obj.a.ab.aba)

const t11 = immuDel(obj, ['x', 'y'])
test(t11, obj)
