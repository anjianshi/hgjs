import React from 'react'
import PropTypes from 'prop-types'
import { BaseInput } from './BaseInput'


// 与 Form 搭配使用的 input，对 Form 与 ReactNative input 间的接口差异进行适配
export class FieldInput extends React.Component {
    static propTypes = {
        field: PropTypes.object.isRequired,
        // 若设为 true，则在按下回车时连带触发 form submit；
        // 表单里只有一个 input 时，可以将此值设为 true；
        // 有多个 input 时，若这些 input 有明确的递进（前后）关系，如“用户名-密码”，肯定是先输用户名再输密码，
        // 那么可以给最后一个 input 设置 submit=true，因为输完这个 input 就可以提交了；
        // 如果各 input 间是平级的关系，例如联系方式表单里的电话号、微信号...，那么所有 input 都不应该设置 submit=true，
        // 不然用户填完一个字段要去填另一个时，会因为按了回车而意外提交表单。
        submit: PropTypes.bool,
        widget: PropTypes.any,      // 实际渲染使用的 input widget
    }

    static defaultProps = {
        submit: false,
        widget: BaseInput
    }

    render() {
        /*
        = ReactNative 与 web 中表单的区别

        ReactNative 中的 onChange 事件并不会把字段的当前值传给回调，要用 onChangeText 来代替。

        ReactNative 中没有 form 这个概念，因此不会在键入回车时自动提交表单
        如果希望模拟这一行为，需要手动监听 onSubmitEditing 回调，利用 Form 特意为此准备的 field 的 onSubmit 回调来触发提交。

        Form 需要通过监听 input 的 onKeyPress 事件来获知用户在文本框里按下了回车，并进行相应的处理。
        ReactNative 中没有 onKeyPress 之类的事件，不过用户每次键入回车时，会触发 onSubmitEditing 事件，因此改为通过它来模拟。

        ReactNative 提供的 input 只接受 string 类型的 value
        这一点交由下层的 input widget 自行修正，并不在此 component 内对 value 强制转换。
        因为 input widget 未必真对依赖于 ReactNative 提供的 input（例如它可能完全是一个自定义控件）；
        即使依赖于 ReactNative 的 input，input widget 也有可能希望接收到非字符串的值，然后由它自己决定要如何将它格式化成字符串。

        -------------

        在 Android 上，貌似即使 blurOnSubmit 为 true，在 submit 时 input 也不会真的 blur，也不会触发 onBlur 回调。
        https://github.com/facebook/react-native/issues/7047
        */
        const { field, submit, widget, ...extra } = this.props
        const Widget = widget
        const props = {
            value: field.props.value,
            onFocus: field.props.onFocus,
            onChangeText: field.props.onChange,
            onSubmitEditing: () => {
                field.props.onKeyPress({ charCode: 13 })
                if(submit) field.props.onSubmit()
            },
            onBlur: field.props.onBlur,
            ...extra
        }
        return <Widget {...props} />
    }
}
