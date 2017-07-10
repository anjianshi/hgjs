import React from 'react'
import PropTypes from 'prop-types'
import { Platform, Modal, View, StyleSheet } from 'react-native'
import invariant from 'invariant'
import { iterSkip } from 'lang'

/*
hgjs 以及 app 代码中的很多工具／组件都要用到 <Modal>。使用者每次使用它们时，都要在页面里额外挂载一个 <Modal>，比较麻烦。
通过此工具，可以解决此问题：只要在 app 里挂载一次此工具提供的 modal component，然后在所有需要显示 modal 的地方就都可以共用这个实例。
并提供函数接口，方便 modal 的开启和关闭。

使用方式：
在 app 里挂载此 <SharedModalRoot/> component，然后所有依赖此 component 的工具／组件就都可以工作了。

此工具支持同时开启多个 modal，关闭时，会从后往前依次关闭
*/


let modalRoot = null


// 见 SharedModalRoot.open()
export function openModal(...args) {
    invariant(modalRoot, 'SharedModal: modalRoot 不存在，请检查 <SharedModalRoot> 是否正常挂载')
    modalRoot.open(...args)
}

// 见 SharedModalRoot.close()
export function closeModal() {
    invariant(modalRoot, 'SharedModal: modalRoot 不存在，请检查 <SharedModalRoot> 是否正常挂载')
    modalRoot.close()
}


export class SharedModalRoot extends React.Component {
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

    withOverlay: 若为 true（默认），modal 自带一个黑色半透明 overlay。如果想自定义 overlay 样式，可以将其设为 false。
    */
    open = (ContentComponent, contentProps=null, modalProps=null, withOverlay=true) => {
        const config = { ContentComponent, contentProps, modalProps, withOverlay }
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

class ModalNode extends React.Component {
    static propTypes = {
        restModals: PropTypes.array,
    }

    render() {
        const { restModals, ...extraProps } = this.props
        const nextRestModals = iterSkip(restModals, 1)
        const { ContentComponent, contentProps, modalProps, withOverlay } = restModals[0]

        const supportedOrientations = ['portrait', 'portrait-upside-down', 'landscape', 'landscape-left', 'landscape-right']
        return <Modal transparent supportedOrientations={supportedOrientations} {...extraProps} {...modalProps}>
            <View style={[s.bg, withOverlay && s.overlayBg]}>
                <ContentComponent {...contentProps} />

                <If condition={nextRestModals.length}>
                    <ModalNode {...extraProps} restModals={nextRestModals} />
                </If>
            </View>
        </Modal>
    }
}


const modalOverlay = Platform.OS === 'android' ? '#00000099' : '#00000066'

const s = StyleSheet.create({
    bg: {
        flex: 1,
    },
    overlayBg: {
        backgroundColor: modalOverlay,
    }
})
