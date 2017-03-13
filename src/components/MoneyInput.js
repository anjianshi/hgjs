import React, { PropTypes } from 'react'
import { extraProps } from 'component'

// 用来输入金额数据的文本框。会把原始的以“厘”为单位的数值转换为以“元”为单位再显示在文本框内部
// 搭配 form 下的 MoneyValidator 使用
// 详见 [处理浮点数](https://github.com/anjianshi/hgjs/blob/master/doc/%E5%A4%84%E7%90%86%E6%B5%AE%E7%82%B9%E6%95%B0.adoc)
export class MoneyInput extends React.Component {
    static propTypes = {
        element: PropTypes.any,
    }

    static defaultProps = {
        element: 'input'
    }

    render() {
        const Elm = this.props.element

        let value = this.props.value
        if(typeof value === 'number') {
            // 在文本框中，禁止在金额是整数时补充 .00 后缀，因为这会给用户的输入增添麻烦
            value = value.toPlainMoney(false)
        }

        return <Elm {...extraProps(this)} value={value} />
    }
}
