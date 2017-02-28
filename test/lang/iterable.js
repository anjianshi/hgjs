import { iterImmuAdd, iterImmuDel, iterImmuInsert, iterImmuReplace, union, intersect, subtract, isSubset } from 'hgjs/lang/newIterable'

const l = 'abcde'.split('')
const s = new Set(l)
const m = new Map(l.map((v, i) => [i, v]))

// let l2 = iterImmuAdd(l, 'q', 'w', 'e')
// console.log('iterImmuAdd', l, l2)

// let s2 = iterImmuAdd(s, 'q', 'w', 'e')
// console.log('iterImmuAdd', s, s2)

// let l3 = iterImmuDel(l, 2)
// console.log('iterImmuDel', l, l3)

// let s3 = iterImmuDel(s, 'c')
// console.log('iterImmuDel', s, s3)

// let l4 = iterImmuDel(l, v => v === 'c')
// console.log('iterImmuDel', l, l4)

// let l5 = iterImmuDel(l, v => v === 'x')
// console.log('iterImmuDel', l, l5)

// let l6 = iterImmuInsert(l, 1, 'x', 'y', 'z')
// console.log('iterImmuInsert', l, l6)

// let s6 = iterImmuInsert(s, 1, 'x', 'y', 'z')
// console.log('iterImmuInsert', s, s6)

// let l7 = iterImmuReplace(l, 1, 'x', 'y', 'z')
// console.log('iterImmuReplace', l, l7)

// let l8 = iterImmuReplace(l, v => v === 'b', 'x', 'y', 'z')
// console.log('iterImmuReplace', l, l8)

// let s7 = iterImmuReplace(s, 'a', 'x', 'y', 'z')
// console.log('iterImmuReplace', s, s7)

// =================================

// let l8 = union(l, ['x', 'y', 'x', 'e'])
// console.log('union', l, l8)

// let l9 = union(l, new Set(['x', 'y', 'x', 'e']))
// console.log('union', l, l9)

// let s8 = union(s, ['x', 'y', 'x', 'e'])
// console.log('union', s, s8)

// let l10 = intersect(l, 'cex'.split(''))
// console.log('intersect', l, l10)

// let l11 = intersect(l, new Set('cex'.split('')))
// console.log('intersect', l, l11)

// let s10 = intersect(s, 'cex'.split(''))
// console.log('intersect', s, s10)

// let l12 = subtract(l, 'bxe'.split(''))
// console.log('subtract', l, l12)

// let l13 = subtract(l, new Set('bxe'.split('')))
// console.log('subtract', l, l13)

// let s12 = subtract(s, 'bxe'.split(''))
// console.log('subtract', s, s12)

// let l14 = isSubset(l, 'bxe'.split(''))
// console.log('isSubset', !l14)

// let l15 = isSubset(l, 'abcde'.split(''))
// console.log('isSubset', l15)

// let l16 = isSubset(l, 'abcdef'.split(''))
// console.log('isSubset', l16)

// let s14 = isSubset(s, 'abc'.split(''))
// console.log('isSubset', !s14)

// let s15 = isSubset(s, 'abcde'.split(''))
// console.log('isSubset', s15)

