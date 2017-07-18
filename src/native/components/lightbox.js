import React from 'react'
import PropTypes from 'prop-types'
import { View, Text, StyleSheet, TouchableWithoutFeedback, TouchableOpacity } from 'react-native'
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

        // lightbox 关闭时会调用此回调，传入关闭时当前显示的图片 index
        // (lastIndex) =>
        onClose: PropTypes.func
    }

    componentWillMount() {
        this.props.sharedModalOnCancel(this.close)
    }

    currIndex = 0
    onSlide = (newIndex) => this.currIndex = newIndex

    close = () => {
        if(this.props.onClose) this.props.onClose(this.currIndex)
        sharedModal.close()
    }

    render() {
        const { data, initialIndex } = this.props

        return <View style={s.overlay}>
            <ImageSlide data={data} renderItem={this.renderItem} initialIndex={initialIndex}
                onSlide={this.onSlide} showNumber={false} />

            <View style={s.closeWrap}>
                <TouchableOpacity onPress={this.close}>
                    <Text style={s.close}>关闭</Text>
                </TouchableOpacity>
            </View>
        </View>
    }

    renderItem = ({item, index}) => {
        return <TouchableWithoutFeedback onPress={this.close}>
            {this.props.renderItem({item, index})}
        </TouchableWithoutFeedback>
    }
}

const s = responsiveObject(win => StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: '#111',
    },

    closeWrap: {
        backgroundColor: 'transparent',
        position: 'absolute',
        right: 20,
        top: win.iOSStatusBarSize + 10,
    },
    close: {
        color: 'white',
        fontSize: 16,
    }
}))
