import React from 'react'
import PropTypes from 'prop-types'
import { Platform, View, StyleSheet, TouchableWithoutFeedback } from 'react-native'
import invariant from 'invariant'
import { iterSkip } from 'lang'
import { TouchFixedModal } from './TouchFixedModal'

/*
hgjs 以及 app 代码中的很多工具／组件都要用到 <Modal>。使用者每次使用它们时，都要在页面里额外挂载一个 <Modal>，比较麻烦。
通过此工具，可以解决此问题：只要在 app 里挂载一次此工具提供的 modal component，然后在所有需要显示 modal 的地方就都可以共用这个实例。
并提供函数接口，方便 modal 的开启和关闭。

使用方式：
在 app 里挂载此 <SharedModalRoot/> component，然后所有依赖此 component 的工具／组件就都可以工作了。

此工具支持同时开启多个 modal，关闭时，会从后往前依次关闭
*/


let modalRoot = null

export function open(config) {
    invariant(modalRoot, 'SharedModal: modalRoot 不存在，请检查 <SharedModalRoot> 是否正常挂载')
    modalRoot.open(config)
}

export function close() {
    invariant(modalRoot, 'SharedModal: modalRoot 不存在，请检查 <SharedModalRoot> 是否正常挂载')
    modalRoot.close()
}


export class Root extends React.Component {
    state = {
        modals: [],   // [ config, ... ]
    }

    componentWillMount() {
        invariant(!modalRoot, 'SharedModal: 错误，请检查 <SharedModalRoot> 是否重复挂载')
        modalRoot = this
    }

    componentWillUnmount() {
        modalRoot = null
    }

    /*
    开启一个新 modal

    config:
        ContentComponent    modal 内容。以 compoent 的形式提供
        contentProps        要传给 ContentComponent 的 props
        modalProps          要传给 react-native <Modal> 的 props
                            可以通过在挂载 <SharedModalRoot> 时向其指定一些 props，来指定对所有 modal 都有效的全局 modalProps
        onCancel            在 Android 下触发 onRequestClose 时，会调用此回调。
                            通过渲染此模块提供的 <Overlay> component，还可以实现在用户点击 overlay 时也触发此回调。详见 <Overlay> 的说明。
                            未指定此回调时，默认行为是关闭 modal。使用者可以手动指定此属性为 falsy 值或空函数来禁用此默认行为。
                            因为提供了此回调，使用者不必也不支持额外指定 onRequestClose 了。
    */
    open = (config) => {
        config = {
            contentProps: null,
            modalProps: null,
            onCancel: () => this.close(),
            ...config
        }

        this.setState({
            modals: [...this.state.modals, config]
        })
    }

    // 关闭最后一个开启的 modal
    close = () => {
        const modals = [...this.state.modals]
        modals.pop()
        this.setState({ modals })
    }

    render() {
        const { modals } = this.state
        return modals.length ? <ModalNode {...this.props} restModals={modals} /> : null
    }
}

// react-native 里，modal 不能并行同时出现，但可以嵌套起来出现，
// 因此通过此 component 递归地将 models 渲染出来
class ModalNode extends React.Component {
    static propTypes = {
        restModals: PropTypes.array,
    }

    static childContextTypes = {
        sharedModalOnCancel: PropTypes.func,
    }

    getChildContext() {
        return { sharedModalOnCancel: this.props.restModals[0].onCancel }
    }

    render() {
        const { restModals, ...gloalModalProps } = this.props
        const nextRestModals = iterSkip(restModals, 1)
        const { ContentComponent, contentProps, modalProps, onCancel } = restModals[0]

        const realModalProps = {
            transparent: true,
            supportedOrientations: ['portrait', 'portrait-upside-down', 'landscape', 'landscape-left', 'landscape-right'],
            ...gloalModalProps,
            ...modalProps,
            onRequestClose: onCancel || (() => {})
        }

        return <TouchFixedModal {...realModalProps}>
            <ContentComponent {...contentProps} />

            <If condition={nextRestModals.length}>
                <ModalNode {...gloalModalProps} restModals={nextRestModals} />
            </If>
        </TouchFixedModal>
    }
}

/*
使用者可以通过渲染此 component 在 modal 里得到一个灰色背景。
用户点击此背景部分时，还会触发 modal 的 onCancel 回调。

此 component 的渲染方式有两种，可根据需要选择：

1. 并列渲染
<ContainerView style={{flex: 1}}>
    <Overlay />
    {modal content}
</ContainerView>

2. 嵌套渲染
<Overlay>
    {modal content}
</Overlay>

嵌套渲染时 modal content 的顶层*必须*是一个 <View>，不然会影响对触摸事件对处理（导致触摸 modal content 内部也会触发 overlay 的 onCancel）
此外，modal content 不要无谓地扩大空间，例如占满整个屏幕，这会使得 overlay 被挡住，无法触发 onCancel 事件。
*/
export class Overlay extends React.Component {
    static propTypes = {
        style: PropTypes.any,
        children: PropTypes.node,
    }

    static contextTypes = {
        sharedModalOnCancel: PropTypes.func
    }

    render() {
        return <TouchableWithoutFeedback onPress={this.context.sharedModalOnCancel}>
            <View style={[s.overlay, this.props.style]}>
                <If condition={this.props.children}>
                    <TouchableWithoutFeedback onPress={() => {}}>
                        {this.props.children}
                    </TouchableWithoutFeedback>
                </If>
            </View>
        </TouchableWithoutFeedback>
    }
}


export const overlayColor = Platform.OS === 'android' ? '#00000099' : '#00000066'

const s = StyleSheet.create({
    overlay: {
        backgroundColor: overlayColor,
        bottom: 0,
        left: 0,
        position: 'absolute',
        right: 0,
        top: 0,
    },
})
