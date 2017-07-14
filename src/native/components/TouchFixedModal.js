import React from 'react'
import { Modal, View } from 'react-native'

/*
修正 react-native <Modal> 对触摸事件的处理

react-native 中，为保证触摸事件不会被 <Modal> 外的内容所响应，在 <Modal> 底层对 onStartShouldSetResponder 进行了响应，
以使 start 和 move 流程都不再向上传递。
https://github.com/facebook/react-native/blob/ec68536e085175209a20e22857136371b3d057c4/Libraries/Modal/Modal.js#L225

但这样做导致在 modal 内部无法正常响应 onMoveShouldSetResponder：
一个元素设置了 onMoveShouldSetResponder 回调，当触摸事件发生时，如果其下没有任何 child 在 start 流程内成为 responder，
那么 modal 底层就会成为 responder，然后 move 流程就不会再执行。
那个元素的 onMoveShouldSetResponder 也就永远不会被触发。
只有在某个 child 在 start 流程内成为 responder 的情况下，parent 的 onMoveShouldSetResponder 才有可能被调用。

解决办法：
经测试，react-native 里的触摸事件是支持 e.stopPropagation() 的，
通过它在 <Modal> 底层调用它，就可以既保证触摸事件不会传递到 <Modal> 外面，又使 <Modal> 底层无需成为 responder 而影响后续触摸流程。

相关资料：
https://anjianshi.atlassian.net/wiki/spaces/WDH/pages/4149014/ReactNative#ReactNative相关笔记-GestureResponderSystem中responder身份的取得
*/

export class TouchFixedModal extends React.Component {
    render() {
        const { children, ...modalProps } = this.props
        return <Modal {...modalProps}>
            <View style={{flex: 1}} {...responderProps}>{children}</View>
        </Modal>
    }
}

const responderProps = {
    onStartShouldSetResponder(e) {
        e.stopPropagation()
        return false
    },

    onMoveShouldSetResponder(e) {
        e.stopPropagation()
        return false
    },
}
