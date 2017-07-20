import React from 'react'
import PropTypes from 'prop-types'
import { View, StyleSheet, TouchableWithoutFeedback } from 'react-native'
import { responsive, responsiveObject } from 'hgjs/native/responsive'
import { sharedModal, ImageSlide } from 'hgjs/native/components'


export function openLightbox(config) {
    sharedModal.open({
        ContentComponent: Lightbox,
        contentProps: config,
    })
}


@responsive
class Lightbox extends React.Component {
    static propTypes = {
        // 见 ImageSlide
        data: PropTypes.array.isRequired,
        renderItem: PropTypes.func.isRequired,
        initialIndex: PropTypes.number,

        // 生成一个自定义 header
        // (currIndex, close) => element
        // 在 element 里调用 close() 能关闭 Lightbox
        renderHeader: PropTypes.func,

        // 生成一个自定义 footer
        // (currIndex, close) => element
        renderFooter: PropTypes.func,

        // lightbox 关闭时会调用此回调，传入关闭时当前显示的图片 index
        // (lastIndex) =>
        onClose: PropTypes.func
    }

    state = {
        currIndex: 0
    }

    componentWillMount() {
        this.props.sharedModalOnCancel(this.close)
    }

    onSlide = (newIndex) => this.setState({ currIndex: newIndex })

    close = () => {
        if(this.props.onClose) this.props.onClose(this.state.currIndex)
        sharedModal.close()
    }

    render() {
        const { data, initialIndex, renderHeader, renderFooter } = this.props

        return <View style={s.overlay}>
            <ImageSlide data={data} renderItem={this.renderItem} initialIndex={initialIndex}
                onSlide={this.onSlide} showNumber={false} />

            <If condition={renderHeader}>
                {renderHeader(this.state.currIndex, this.close)}
            </If>
            <If condition={renderFooter}>
                {renderFooter(this.state.currIndex, this.close)}
            </If>
        </View>
    }

    renderItem = ({item, index}) => {
        return <TouchableWithoutFeedback onPress={this.close}>
            {this.props.renderItem({item, index})}
        </TouchableWithoutFeedback>
    }
}

const s = responsiveObject(() => StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: '#111',
    }
}))
