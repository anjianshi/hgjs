import { omit, keys } from 'lodash'

// 返回当前 component 接收到的、没有定义在 propTypes 里的 props。
// 这些 props 通常是用来传给下级 component 的。
export function extraProps(componentInstance) {
    return omit(componentInstance.props, keys(componentInstance.constructor.propTypes))
}
