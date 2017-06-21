import React from 'react'
import { TouchableWithoutFeedback, StyleSheet, Keyboard } from 'react-native'

/*
构建一个面板，用户只要碰到它的任意一个地方，就能让其下的文本框失去焦点
一般用在有表单的页面，包裹在外层

但要注意，一定不要把它放在 <ScrollView> 的外面，不然在 input 没有焦点的情况下，<ScrollView> 的滚动功能会失效。
也不用把它放在 <ScrollView> 的里面。<ScrollView> 自带 dismiss 功能。
如果 <ScrollView> 平级的前面和后面也有内容，可以考虑用此元素包裹前面和后面的这些内容。
*/
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
