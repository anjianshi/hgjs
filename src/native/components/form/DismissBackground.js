import React from 'react'
import { TouchableWithoutFeedback, StyleSheet, Keyboard } from 'react-native'


// 构建一个面板，用户只要碰到它的任意一个地方，就能让其下的文本框失去焦点
// 一般用在有表单的页面，放在最外层
export class DismissBackground extends React.Component {
    render() {
        return <TouchableWithoutFeedback style={styles.background} onPress={Keyboard.dismiss}>
            {this.props.children}
        </TouchableWithoutFeedback>
    }
}


const styles = StyleSheet.create({
    background: {
        flex: 1,
    }
})
