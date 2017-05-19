import React from 'react'
import PropTypes from 'prop-types'
import { View, Image, StyleSheet, PixelRatio } from 'react-native'
import resolveAssetSource from 'react-native/Libraries/Image/resolveAssetSource'
import { enhanceState, enhanceProps, extraProps } from 'component'
import { emulateNative } from 'native/component'
import { shallowEqual } from 'lang'
import { Promise } from 'promise'

/*
自动设定 image 的尺寸

1. 若容器明确指定了尺寸，例如显式指定了 width 和 height，或设置了 flex: 1，
   则当 image 大于容器时，会将其缩放到和容器一样大；当 image 小于容器时，保留 image 原大小，并居中。
   （思路来自：react-native-fit-image）

   若容器只设置了宽度或高度，则图片在没设置尺寸的那一边的大小不受限制。
   若宽度和高度都没设置，则图片尺寸完全不受限制，按原尺寸显示。

   此 component 会占满容器的空间，因此容器不应设置 alignItems: 'center' 和 justifyContent: 'center' style。
   让图片居中的任务交给此 component 来完成。

2. 根据当前设备的 ratio，压缩图片尺寸
*/


@emulateNative
@enhanceState
@enhanceProps
export class AutoSizeImage extends React.Component {
    static propTypes = {
        source: PropTypes.oneOfType([
            PropTypes.object,
            PropTypes.number,       // 以 require(...) 的形式引入时，source 值是数字
        ]).isRequired,

        style: PropTypes.any,
        // 其他 props 会传给 <Image />
    }

    state = {
        imgRealWidth: null,
        imgRealHeight: null,
        containerWidth: null,
        containerHeight: null,

        imgRenderWidth: 0,
        imgRenderHeight: 0,
    }

    componentWillMount() {
        this.getRealImgSize()
    }

    componentWillUnmount() {
        if(this.getSizePromise) this.getSizePromise.cancel()
    }

    componentDidReceiveProps(prevProps) {
        if(!shallowEqual(this.props.source, prevProps.source)) {
            this.getRealImgSize()
        }
    }

    containerOnLayout = event => {
        const { width, height } = event.nativeEvent.layout
        this.setState({
            containerWidth: width,
            containerHeight: height,
        })

        if(this.pendState.imgRealWidth !== null) this.computeImgSize()
    }

    getRealImgSize() {
        const { source } = this.props

        const got = (width, height) => this.batchedUpdates(() => {
            width = Math.round(width / PixelRatio.get())
            height = Math.round(height / PixelRatio.get())

            this.setState({
                imgRealWidth: width,
                imgRealHeight: height,
            })

            if(this.pendState.containerWidth !== null) {
                this.computeImgSize()
            }
        })

        if(typeof source === 'number') {
            /*
            针对通过 require(...) 引入进来的 source，这里使用了一个从 react-native 源码里找出来的方法。
            https://github.com/facebook/react-native/blob/master/Libraries/Image/Image.android.js

            通过使用 resolveAssetSource() 函数，可以把 number 的 source 解析成完整的 source 对象，
            顺便还提供了图片的 width 和 height，因此也不用再手动获取了。
            */
            const resolvedSource = resolveAssetSource(source)
            got(resolvedSource.width, resolvedSource.height)
        } else {
            this.getSizePromise = new Promise((resolve, _, onCancel) => {
                let cancelled = false
                onCancel(() => { cancelled = true })

                Image.getSize(this.props.source.uri, (width, height) => {
                    if(!cancelled) resolve([width, height])
                })
            })

            this.getSizePromise.then(([width, height]) => {
                got(width, height)
                this.getSizePromise = null
            })
        }
    }

    computeImgSize() {
        const realWidth = this.pendState.imgRealWidth,
            realHeight = this.pendState.imgRealHeight,
            maxWidth = this.pendState.containerWidth || Infinity,
            maxHeight = this.pendState.containerHeight || Infinity

        let renderWidth, renderHeight
        const scaleMultiple = Math.max(realWidth / maxWidth, realHeight / maxHeight)
        if(scaleMultiple > 1) {
            renderWidth = Math.floor(realWidth / scaleMultiple)
            renderHeight = Math.floor(realHeight/ scaleMultiple)
        } else {
            renderWidth = realWidth
            renderHeight = realHeight
        }
        this.setState({
            imgRenderWidth: renderWidth,
            imgRenderHeight: renderHeight,
        })
    }

    render() {
        const imgStyle = [
            this.props.style,
            { width: this.state.imgRenderWidth, height: this.state.imgRenderHeight },
        ]

        return <View style={styles.container} onLayout={this.containerOnLayout}>
            <Image {...extraProps(this)} source={this.props.source} style={imgStyle} />
        </View>
    }
}


const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    }
})
