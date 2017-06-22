import React from 'react'
import { TextInput, Platform } from 'react-native'


// 根据常见的需求，对默认的 TextInput 进行一些定制
export class BaseInput extends React.Component {
    state = {
        selection: null
    }

    /*
    修正 multiline TextInput 在 Android 的中文输入法下无法换行的问题
    http://bbs.reactnative.cn/topic/4064/android-%E4%B8%8B-multiline-%E7%9A%84-textinput-%E5%9C%A8%E4%B8%AD%E6%96%87%E8%BE%93%E5%85%A5%E6%B3%95%E9%87%8C%E6%97%A0%E6%B3%95%E6%8D%A2%E8%A1%8C%E5%95%8A

    正常情况下，在 multiline TextInput 里按回车，应该触发 onChange 和 onChangeText，
    但在 Android 的中文输入法下（谷歌拼音输入法的拼音模式、其他输入法的中英文模式都是），触发的是 onSubmitEditing 和 onEndEditing，且按下后会使得 input blue、键盘关闭。

    通过设置 blurOnSubmit 为 false 可以使得 input 不再 blur，而触发的事件会变成连着触发两次 onSubmitEditing，不再触发 onEndEditing。

    解决办法：
    在 Android 下，对于 multiline 的 TextInput，把 blurOnSubmit 设置为 false 来解决 input blur 的问题，
    然后在 onSubmitEditing 被触发时，模拟 onChangeText 事件，向 value 末尾添加一个换行符。

    缺点：
    . 只能模拟 onChangeText，不能模拟 onChange，因为缺少 onChagne 事件的 nativeEvent 数据。
    . blurOnSubmit 被锁定为 false，不允许被设为其他值
    */
    _latestSubmit = null
    onSubmitEditing = e => {
        // 实现只响应第一次 onSubmitEditing 事件
        // 系统连着触发两次事件时，它们之间的间隔会很短，远远比人为触发的要短；因此可以根据这一点判断出哪两次事件是系统自动连续触发的。
        // 经测试，两次 onSubmitEditing 调用的间隔大概是 30，虽然每台机器可能都不一样，但在慢应该也不会达到10倍，所以这里把间隔小于 300 的都是为连续触发。
        const latestSubmit = this._latestSubmit
        this._latestSubmit = e.timeStamp
        if(latestSubmit && (e.timeStamp - latestSubmit) < 300) return

        if(this.props.onChangeText) {
            const value = this.props.value || ''
            const { start, end } = this.state.selection
            const newValue = value.slice(0, start) + '\n' + value.slice(end)        // 当光标不在末尾、或有文字被选中时，要在光标所在位置或选中位置添加回车
            this.props.onChangeText(newValue)

            // 更新光标位置，让其出现在换行符后面
            // 当 input 里有文本被选中时，系统会自动设置一次 selection，这里通过包裹 setTimeout，让我们设置的 selection 在系统自动设置之后再生效，以免被系统自动设置的值覆盖。
            setTimeout(() =>
                this.setState({
                    // 光标处于文本末尾时，向后指定光标位置会出错。因为此时 input 里的文本内容还没有更新（要等上级处理完 onChangeText 回调把新的包含回车的值传回来才行）。
                    // 解决办法是在这种情况下不要手动光标位置，让系统自动处理
                    selection: start === value.length ? null : { start: start + 1 }
                })
            )
        }

        // 无需再触发 this.props.onSubmitEditing。在 multiline 的情况下，它压根就不应该被触发。
    }
    onSelectionChange = e => {
        this.setState({ selection: e.nativeEvent.selection })
        if(this.props.onSelectionChange) this.props.onSelectionChange(e)
    }

    render() {
        const { value, ...extra } = this.props

        const props = {
            clearButtonMode: 'while-editing',                  // iOS only
            autoCapitalize: 'none',
            autoCorrect: false,
            value: value !== null ? value.toString() : '',     // react-native 的 TextInput 只支持接收 string
            ...extra,
        }

        const fixMultilineProps = Platform.OS === 'android' && this.props.multiline && {
            blurOnSubmit: false,
            onSubmitEditing: this.onSubmitEditing,
            onSelectionChange: this.onSelectionChange,
            selection: this.props.selection || this.state.selection,
        }

        return <TextInput {...props} {...fixMultilineProps} />
    }
}
