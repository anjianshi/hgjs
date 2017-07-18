import React from 'react'
import PropTypes from 'prop-types'
import { FlatList, View, Text, StyleSheet, Platform } from 'react-native'
import { getRef } from 'component'
import { responsive, responsiveObject } from 'native/responsive'
import { isEqual } from 'lodash'

/*
此 component 的宽度必须总是与窗口宽度相等
*/
@responsive
@getRef
export class ImageSlide extends React.Component {
    static propTypes = {
        // 见 Slider 的 props
        data: PropTypes.array.isRequired,
        renderItem: PropTypes.func.isRequired,
        initialIndex: PropTypes.number,

        // 是否显示当前图片编号和总图片数
        showNumber: PropTypes.bool,
        // 当前图片变化时，会调用此方法
        // (newIndex) =>
        onSlide: PropTypes.func,
    }

    static defaultProps = {
        showNumber: true
    }

    state = {
        currIndex: 0,
    }

    // 此方法公开出来供使用者调用
    // 注意：此 component 必须通过 getRef props 来取得 ref
    slideTo = (...args) => this.slider.slideTo(...args)

    onSlide = newIndex => {
        this.setState({ currIndex: newIndex })
        if(this.props.onSlide) this.props.onSlide(newIndex)
    }

    render() {
        const { data, renderItem, initialIndex, showNumber } = this.props
        const { currIndex } = this.state

        return <View>
            <Slider
                getRef={r => this.slider = r}
                data={data} renderItem={renderItem} initialIndex={initialIndex} onSlide={this.onSlide} />

            <If condition={showNumber && data.length}>
                <View style={[s.count, data.length >= 10 ? s.countLarge : s.countSmall]}>
                    <Text style={s.countText}>
                        {currIndex + 1}/{data.length}
                    </Text>
                </View>
            </If>
        </View>
    }
}


@responsive
@getRef
class Slider extends React.PureComponent {
    static propTypes = {
        // [item, ...]
        data: PropTypes.array.isRequired,

        /*
        ({ item, index }) => element
        data 为空时，也会用 null 为 item 调用一次此函数，此时此函数可以考虑渲染一个 placeholder

        使用者需自行保证渲染出的 element 的宽度与 slider 宽度（即屏幕宽度）相等。
        （不用考虑在横竖屏转换时的重新渲染问题，此 component 会自动在需要时调用此函数重新渲染）
        高度可以任意，element 的高度决定了 slider 的高度。
        */
        renderItem: PropTypes.func.isRequired,

        // 初始显示第几张图片
        initialIndex: PropTypes.number,

        onSlide: PropTypes.func.isRequired,     // (newIndex) =>
    }

    componentDidMount() {
        this.scrollToInitialIndex()
    }

    componentWillReceiveProps(nextProps) {
        this.detectFixScrollOffset(nextProps)
        this.detectResetScrollOffset(nextProps)
    }

    componentDidUpdate() {
        this.fixScrollOffset()
    }

    get winWidth() { return this.props.windowData.width }

    slideTo = (index, animated=false) => {
        this.list.scrollToOffset({
            offset: index * this.winWidth,
            animated
        })
    }

    currIndex = 0
    countIndex = e => {
        const x = e.nativeEvent.contentOffset.x
        if(x % this.winWidth === 0) {
            this.currIndex = x / this.winWidth
            this.props.onSlide(this.currIndex)
        }
    }

    // FlatList 自带的 initialIndex 功能在 Android 下会有图片闪烁的问题。没有找到解决办法。
    // 因此改为自己手动进行滚动。
    scrollToInitialIndex = () => {
        if(this.props.initialIndex) {
            setTimeout(() => this.slideTo(this.props.initialIndex))
        }
    }

    // 横竖屏转换时，需要手动修正 scroll offset
    shouldFixScrollOffset = false
    detectFixScrollOffset(nextProps) {
        if(this.props.windowData.portrait !== nextProps.windowData.portrait) {
            this.shouldFixScrollOffset = true
        }
    }
    fixScrollOffset() {
        if(this.shouldFixScrollOffset) {
            this.shouldFixScrollOffset = false

            if(Platform.OS === 'android') {
                // Android 下，不加 setTimeout 的话，在翻到往后一点的地方，然后横竖屏转换时，会无法修正到预期的尺寸
                setTimeout(() => this.slideTo(this.currIndex))
            } else {
                this.slideTo(this.currIndex)
            }
        }
    }

    // data 列表发生变化时，重置 scroll offset
    detectResetScrollOffset(nextProps) {
        if(!isEqual(this.props.data, nextProps.data)) {
            this.slideTo(0, true)
        }
    }

    getKey = (item, index) => `${index}-${item}`    // 因为可能有同一个图片出现多次的情况，所以要把 index 也加到 key 里，以免 key 重复
    renderEmpty = () => this.props.renderItem({ item: null, index: 0 })

    getItemLayout = (data, index) => ({
         length: this.winWidth, offset: this.winWidth * index, index: index
    })

    render() {
        return <FlatList
            ref={r => this.list = r}
            horizontal showsHorizontalScrollIndicator={false} pagingEnabled
            onScroll={this.countIndex}
            scrollEventThrottle={512}  // 设一下这个 props，省得 Xcode 总是冒出相关 notice

            // 指定 winWidth 为 extraData，以确保横竖屏切换时 item 能重新渲染
            data={this.props.data} extraData={this.winWidth} keyExtractor={this.getKey}
            // 这几个 props 确保了后续只有一个图片会进行预渲染
            initialNumToRender={1} maxToRenderPerBatch={1} windowSize={2}
            // 设置了上面几个 props 的情况下，若不实现 getItemLayout，在横竖屏转换时会无法正确修正 scroll offset
            // 估计是因为不实现此方法的话，在进行修正时 FlatList 就还没来得及计算好 element 宽度。（例如设置一个长点的 timeout，就能正确修正了）
            getItemLayout={this.getItemLayout}
            renderItem={this.props.renderItem} ListEmptyComponent={this.renderEmpty}
        />
    }
}


const s = responsiveObject(() => StyleSheet.create({
    imagesWrap: {
        flexDirection: 'row',
    },
    count: {
        alignItems: 'center',
        backgroundColor: '#00000099',
        bottom: 10,
        justifyContent: 'center',
        position: 'absolute',
        right: 10,
    },
    countSmall: {
        borderRadius: 15,
        height: 30,
        width: 30,
    },
    countLarge: {
        borderRadius: 18,
        height: 36,
        width: 36,
    },
    countText: {
        color: 'white',
        fontSize: 11,
    }
}))
