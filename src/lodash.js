export assign from 'lodash/assign'
export clone from 'lodash/clone'
export compact from 'lodash/compact'
export differenceBy from 'lodash/differenceBy'
export each from 'lodash/each'
export every from 'lodash/every'
export findIndex from 'lodash/findIndex'
export flatten from 'lodash/flatten'
export flowRight from 'lodash/flowRight'
export fromPairs from 'lodash/fromPairs'
export get from 'lodash/get'
export has from 'lodash/has'
export isEmpty from 'lodash/isEmpty'
export isEqual from 'lodash/isEqual'
export isFunction from 'lodash/isFunction'
export isPlainObject from 'lodash/isPlainObject'
export keys from 'lodash/keys'
export map from 'lodash/map'
export mapValues from 'lodash/mapValues'
export max from 'lodash/max'
export merge from 'lodash/merge'
export omit from 'lodash/omit'
export padStart from 'lodash/padStart'
export pick from 'lodash/pick'
export pickBy from 'lodash/pickBy'
export range from 'lodash/range'
export set from 'lodash/set'
export setWith from 'lodash/setWith'
export size from 'lodash/size'
export some from 'lodash/some'
export sortBy from 'lodash/sortBy'
export sum from 'lodash/sum'
export sumBy from 'lodash/sumBy'
export toPairs from 'lodash/toPairs'
export transform from 'lodash/transform'
export values from 'lodash/values'

// lodash 的 flatMap 不能正确处理 ES6 Set，使用起来有危险，改用自行实现的 lang/flatMap 代替
// 这里导出的 _flatMap 是用来让那个代替函数基于它来实现功能
export _flatMap from 'lodash/flatMap'
