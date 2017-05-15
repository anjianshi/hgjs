/*
ReactNative only

支持响应式设计的 StyleSheet 类：ResponsiveStyleSheet
每一个 style item 都支持为部分 rules 指定限制条件，只有当环境符合限制条件时，这些 rules 才会生效。

在具体实现上，ResponsiveStyleSheet 是根据用户指定的限定条件把 rules 细分成多个小部分，每个小部分注册为原生 StyleSheet 的一个 item，
然后用户获取 ResponsiveStyleSheet 里的 item 时，它会以数组形式返回原生 StyleSheet 里与当前环境匹配的 item id。
这里利用了 ReactNative 的一个特性：style 支持返回数组、且支持数组嵌套。即 style={[id, [id]]}

Interface:
    ResponsiveStyleSheet
        create()   建立一个 ResponsiveStyleSheet，详见下面的具体实现

    responsive
       所有使用 ResponsiveStyleSheet 的 component 均需要应用此 decorator，以保证在环境变化时能重新渲染
*/

import React from 'react'
import { StyleSheet, Platform, Dimensions } from 'react-native'
import invariant from 'invariant'
import { isPlainObject } from 'lodash'



// ========== 维护环境变量（例如屏幕宽度／高度）==========
// ResponsiveStyleSheet 需要根据这些变量判断应该应用哪些样式

// 每当 env 更新过后，会触发这些回调
const listeners = new Set()

let env

// 根据传入的 Dimensions 数据更新 env
function computeEnv(values) {
    // Android 下，获取到的高度并没有把状态栏的高度给抛掉，因为大部分 Android 设备等状态栏高度都一样，所以这里就使用这个常数来修正
    // https://github.com/facebook/react-native/issues/8282
    // 另一篇可能有用的资料：http://stackoverflow.com/questions/35436643/how-to-find-height-of-status-bar-in-android-through-react-native
    const ANDRIOD_STATUS_HEIGHT = 24

    env = {
        width: values.width,
        height: values.height - (Platform.OS === 'android' ? ANDRIOD_STATUS_HEIGHT : 0)
    }

    for(const listener of listeners) listener()
}

computeEnv(Dimensions.get('window'))
Dimensions.addEventListener('change', result => computeEnv(result.window))



// ========== ResponsiveStyleSheet ==========

/*
= items 格式
{
    name: {
        // rules always apply
        key: value,

        "conditions": {
            // rules apply when match conditions
            key: value,

            "sub_conditions": {
                // rules apply when match both conditions and sub_conditions
                key: value
            }
        }
    }
}


= conditions 格式
例子："landscape, w <= 100, h <= 50"

- conditions 由多个 condition 组成，其间用 "," 分隔
- 每个 condition 由三部分组成：condition name、运算符、参数值
  这三部分之间必须用空格隔开
  有的 condition 不需要提供运算符和参数值，此时省略掉后两部分


= 可用的 condition 列表

== 关键字类
这类 condition 无需指定运算符和参数值

x|portrait     内容竖向显示（高大于宽）时为 true
y|landscape    内容横向显示（宽大于高）时为 true（内容宽高相等时，这两个关键字都为 true）

== 数值类
这类 condition 需要搭配运算符和参数值进行判断

w|width      屏幕宽度
h|height     屏幕高度

支持的运算符：<、>、<=、>=
*/

export const ResponsiveStyleSheet = {
    create(items={}) {
        const nativeItems = {}      // 要传给实际的 StyleSheet 的 rules
        const responsiveItems = {}  // { itemName: parsedRules, ... }
                                    // responsiveRules 下的一个 item，对应于 nativeRules 下的多个 item
        const bridge = {}           // { get [resonsiveItemName]: [...nativeItemIds] }
                                    // 因为在不同 env 下，要返回的 native

        const getNativeItemKey = (itemName, i) => `resp:${itemName}:${i}`

        for(const [itemName, rawRules] of Object.entries(items)) {
            const collection = parseStyleRules(rawRules)
            responsiveItems[itemName] = collection

            for(let i = 0; i < collection.length; i++) {
                nativeItems[getNativeItemKey(itemName, i)] = collection[i].rules
            }

            Object.defineProperty(bridge, itemName, {
                get() {
                    const nativeItemIds = []
                    for(let i = 0; i < collection.length; i++) {
                        if(matchConditions(collection[i].conditions)) {
                            nativeItemIds.push(
                                nativeStyleSheet[getNativeItemKey(itemName, i)]
                            )
                        }
                    }
                    return nativeItemIds
                }
            })
        }

        const nativeStyleSheet = StyleSheet.create(nativeItems)

        return bridge
    }
}

function matchConditions(conditions) {
    for(const { fn, args } of conditions) {
        if(!fn(...args)) return false
    }
    return true
}


// 把递归结构的 rules 解析成 [ {conditions, rules: styleRules}, ... ] 的扁平结构
function parseStyleRules(rawRules) {
    const commonRules = {}
    const collection = [
        { conditions: [], rules: commonRules }
    ]
    for(const [key, value] of Object.entries(rawRules)) {
        if(isPlainObject(value)) {
            const baseConditions = parseConditions(key)
            for(const parsedSubRules of parseStyleRules(value)) {
                collection.push({
                    conditions: [...baseConditions, ...parsedSubRules.conditions],
                    rules: parsedSubRules.rules
                })
            }
        } else {
            commonRules[key] = value
        }
    }
    return collection
}


// 传入 conditions str，返回一个经过整理的 conditions
// [ {fn: conditionFn, args}, ... ]
function parseConditions(conditionsStr) {
    return conditionsStr
        .split(',')
        .map(s => s.trim())
        .map(conditionStr => {
            const [name, ...args] = conditionStr.split(' ').map(s => s.trim())
            const realName = conditionFnAlias[name] || name
            invariant(realName in conditionFns, `condition "${name}" 不存在`)
            return { fn: conditionFns[realName], args }
        })
}

const conditionFns = {
    portrait: () => env.height >= env.width,        // 竖向
    landscape: () => env.width >= env.height,       // 横向

    width: (symbol, value) => {
        const symbolFn = computeSymbols[symbol]
        invariant(symbolFn, `condition width: symbol "${symbol}" 不存在`)

        const parsedValue = parseInt(value)
        invariant(isFinite(parsedValue), `condition width: value "${value}" 不是合法的整数`)

        return symbolFn(env.width, parsedValue)
    },

    height: (symbol, value) => {
        const symbolFn = computeSymbols[symbol]
        invariant(symbolFn, `condition height: symbol "${symbol}" 不存在`)

        const parsedValue = parseInt(value)
        invariant(isFinite(parsedValue), `condition height: value "${value}" 不是合法的整数`)

        return symbolFn(env.height, parsedValue)
    },
}

const conditionFnAlias = {
    'y': 'portrait',
    'x': 'landscape',
    'w': 'width',
    'h': 'height',
}

const computeSymbols = {
    '<': (a, b) => a < b,
    '>': (a, b) => a > b,
    '<=': (a, b) => a <= b,
    '>=': (a, b) => a >= b,
}


// ========== decorator ==========
// 所有使用 ResponsiveStyleSheet 的 component 均需要应用此 decorator，以保证在环境变化时能重新渲染

export function responsive(Component) {
    return class Responsive extends React.Component {
        state = { env }

        componentWillMount() {
            listeners.add(this.updateEnv)
        }

        componentWillUnmount() {
            listeners.delete(this.updateEnv)
        }

        updateEnv = () => this.setState({ env })

        render() {
            return <Component _responsiveEnv={this.state.env} />
        }
    }
}
