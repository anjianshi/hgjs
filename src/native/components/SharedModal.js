import React from 'react'
import { Modal, StyleSheet, View } from 'react-native'
import invariant from 'invariant'


/*
hgjs 以及 app 代码中的很多工具／组件都要用到 <Modal>。使用者每次使用它们时，都要在页面里额外挂载一个 <Modal>，比较麻烦。
通过此工具，可以解决此问题：只要在 app 里挂载一次此工具提供的 modal component，然后在所有需要显示 modal 的地方就都可以共用这个实例。
并提供函数接口，方便 modal 的开启和关闭。

使用方式：
在 app 里挂载此 <SharedModal/> component，然后所有依赖此 component 的工具／组件就都可以工作了。
*/


let instance = null


// 参数格式见 SharedModal.open()
export function openModal(...args) {
    invariant(instance, 'SharedModal: instance 不存在，请检查 <SharedModal> 是否正常挂载')
    instance.open(...args)
}

export function closeModal() {
    invariant(instance, 'SharedModal: instance 不存在，请检查 <SharedModal> 是否正常挂载')
    instance.close()
}


export class SharedModal extends React.Component {
    // props 均会传给 <Modal>

    state = {
        ContentComponent: null,
        contentProps: null,
        modalProps: null,
        withBg: null,
    }

    componentWillMount() {
        invariant(!instance, 'SharedModal: instance 已存在，请检查 <SharedModal> 是否重复挂载')
        instance = this
    }

    componentWillUnmount() {
        instance = null
    }

    /*
    withBg: 若为 true（默认），modal 自带一个黑色半透明 overlay。如果想自定义 overlay 样式，可以将其设为 false。
    */
    open = (ContentComponent, contentProps, modalProps, withBg=true) => {
        invariant(!this.state.ContentComponent, 'SharedModal: modal 已经处于开启状态，不支持同时开启多个 modal')

        this.setState({
            ContentComponent,
            contentProps,
            modalProps,
            withBg
        })
    }

    close = () => {
        this.setState({
            ContentComponent: null,
            contentProps: null,
            modalProps: null,
            withBg: null
        })
    }

    render() {
        const { ContentComponent, contentProps, modalProps, withBg } = this.state

        if(!ContentComponent) return null

        // 不显示 modal 时，指定一个 onRequestClose 回调的占位符。不然 Android 下会出现警告
        // 显示 modal 时，仍要求使用者自行进行指定
        const preparedProps = !ContentComponent && { onRequestClose: () => {} }

        const supportedOrientations = ['portrait', 'portrait-upside-down', 'landscape', 'landscape-left', 'landscape-right']

        return <Modal {...preparedProps} transparent supportedOrientations={supportedOrientations} {...this.props} {...modalProps}>
            <Choose>
                <When condition={withBg}>
                    <View style={s.bg}>
                        <ContentComponent {...contentProps} />
                    </View>
                </When>
                <Otherwise>
                    <ContentComponent {...contentProps} />
                </Otherwise>
            </Choose>
        </Modal>
    }
}



const modalOverlay = 'rgba(20,20,20,0.5)'

const s = StyleSheet.create({
    bg: {
        backgroundColor: modalOverlay,
        flex: 1,
    }
})
