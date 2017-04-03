import React from 'react'
import { connect } from 'react-redux'
import invariant from 'invariant'
import { pickAs } from 'lang'
import { getState, need, load } from './commonData'

/*
item 格式：
{
    data: string,         commonData init() 里定义的 data name
    prop: string,         （可选）此 data 传给 component 时使用的 prop name，默认和 data name 一样
    forceReload: bool     （可选，默认为 false）若指定为 true，则每次使用时都重新加载数据
}
或
string         也可以指定一个字符串作为 data 值，其他各项均使用默认值。

此函数还会在 props 中额外传入一个 onDataLoaded() 方法。
它和 commonData need() / load() 效果类似，都是在指定数据项载入完成时，调用回调，并将数据传给它。
*/
export const withData = (...rawItems) => WrappedComponent => {
    const items = new Map()     // dataName => forceReload
    const propAliases = {}      // dataName: propName

    for(const item of rawItems) {
        if(typeof item === 'string') {
            items.set(item, false)
            propAliases[item] = item
        } else {
            items.set(item.data, item.forceReload || false)
            propAliases[item.data] = item.props || item.data
        }
    }

    @connect(() => pickAs(getState(), propAliases))
    class CommonDataWrapper extends React.Component {
        componentWillMount() {
            for(const [dataName, forceReload] of items.entries()) {
                if(forceReload) {
                    load(dataName)
                } else {
                    need(dataName)
                }
            }
        }

        onLoaded(dataName, callback) {
            invariant(items.has(dataName), `onDataLoaded: 数据 ${dataName} 不在 withData 列表中，不应对其设置回调，请检查是否有输入错误`)
            return need(dataName).then(callback)
        }

        render() {
            return <WrappedComponent {...this.props} onDataLoaded={this.onLoaded} />
        }
    }
    return CommonDataWrapper
}
