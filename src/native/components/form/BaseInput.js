import React from 'react'
import { TextInput } from 'react-native'

// 根据常见的需求，对默认的 TextInput 进行一些定制
export class BaseInput extends React.Component {
    render() {
        const { value, ...extra } = this.props

        const props = {
            clearButtonMode: 'while-editing',                  // iOS only
            autoCapitalize: 'none',
            autoCorrect: false,
            value: value !== null ? value.toString() : '',     // react-native 的 TextInput 只支持接收 string
            ...extra,
        }
        return <TextInput {...props} />
    }
}
