import { omit, keys } from 'lodash'

/*
返回当前 component 接收到的、没有定义在 propTypes 里的 props。
这些 props 通常是用来传给下级 component 的。

若未指定 props，则从 component.props 中提取；否则从给出的 props 中提取（例如可以把 componentWillReceiveProps() 里接收到的 nextProps 传给此函数）
*/
export function extraProps(componentInstance, props=null) {
    return omit(props || componentInstance.props, keys(componentInstance.constructor.propTypes))
}
