import React from 'react'
import PropTypes from 'prop-types'
import { View, StyleSheet, Platform, Animated } from 'react-native'
import { limit, notLessThen } from 'lang'

/*
实现在内容滚动的同时，header 跟随内容显示／隐藏的功能。

例如一个商品列表页面，在最上面有一个搜索文本框。
用户往上拨动商品列表时，header 会隐藏起来；往回拨动商品列表时，header 又会立刻重新出现（不用等到拨回到列表开头，只要开始回拨，header 就会开始重新出现）

效果设计仿照 Twitter Android 客户端。
暂时没有实现其“在滚动结束后 header 若只显示了一半，自动使其全部显示或完全隐藏”的功能。
*/

export class SwipeHiddenHeader extends React.Component {
    static propTypes = {
        header: PropTypes.element.isRequired,
        children: PropTypes.element.isRequired,
        style: PropTypes.any,
    }

    state = {
        headerHeight: 0,
        headerTop: new Animated.Value(0),       // 使用 Animated 的主要好处不在于性能，而是位置变化时，能提供过渡效果，不会很生硬
        atTop: true,
    }

    headerOnLayout = e => {
        this.setState({
            headerHeight: e.nativeEvent.layout.height,
        })
    }

    latestOffset = null
    headerBack = 0

    onScroll = e => {
        const contentHeight = e.nativeEvent.contentSize.height
        const containerHeight = e.nativeEvent.layoutMeasurement.height

        // 滚动条在常规范围内能滚动的最大／最小距离。超出此范围的值也有可能出现，此时就是处于 bounce 状态
        const maxValidOffset = notLessThen(contentHeight - containerHeight, 0)
        const minValidOffset = 0

        const latestOffset = this.latestOffset
        // 将识别出来的 offset 值强制限制在常规范围内，忽略 bounce 导致的部分
        const offset = limit(minValidOffset, e.nativeEvent.contentOffset.y, maxValidOffset)
        this.latestOffset = offset

        /*
        iOS 下要根据 scroll 内容是否滚动到了顶端来调整界面样式。必须执行 setState() 才能保证重新渲染以使用新样式。
        因为下面对 headerTop 进行的 setState() 在 headerBack 实际并没有变化（不代表 atTop 也不会变化）时会跳过执行，并不可靠，所以这里还是有必要明确执行一下。
        */
        if(Platform.OS !== 'android') {
            const atTop = offset === 0
            if(this.state.atTop !== atTop) {
                this.setState({ atTop })
            }
        }

        const headerBack = limit(
            0,
            this.headerBack + (offset - latestOffset),
            this.state.headerHeight,
        )
        if(headerBack !== this.headerBack) {
            this.headerBack = headerBack

            // 这里还有另一种更新 headerTop 的方法：
            // this.state.headerTop.setValue(-headerBack)
            // 不过视觉效果没有使用 Animated.spring 好，大概是因为它提供了更好的过渡效果

            Animated.spring(this.state.headerTop, {
                toValue: -headerBack,
                speed: 100,
                bounciness: 1,
            }).start()
        }

        if(this.props.children.onScroll) {
            this.props.children.onScroll(e)
        }
    }

    render() {
        const { style, header, children } = this.props
        const { headerTop, headerHeight, atTop } = this.state

        return <View style={[s.container, style]}>
            <Animated.View
                style={[s.header, {top: headerTop}]}
                onLayout={this.headerOnLayout}
            >
                {header}
            </Animated.View>

            <ScrollContent headerHeight={headerHeight} atTop={atTop} onScroll={this.onScroll}>
                {children}
            </ScrollContent>
        </View>
    }
}


// 把 scroll 部分单拆成一个 PureComponent，以使 header 因位置更新而重新渲染时，scroll 部分不会跟着重新渲染，不然会极大地影响性能。
class ScrollContent extends React.PureComponent {
    static propTypes = {
        headerHeight: PropTypes.number.isRequired,
        atTop: PropTypes.bool.isRequired,
        onScroll: PropTypes.func.isRequired,
        children: PropTypes.element.isRequired,
    }

    render() {
        const { headerHeight, atTop, onScroll, children } = this.props

        const scrollProps = {
            onScroll,
            scrollEventThrottle: 16,
        }

        if(children.props.refreshControl) {
            scrollProps.refreshControl = React.cloneElement(
                children.props.refreshControl,
                { progressViewOffset: headerHeight }
            )
        }

        const scrollStyleProps = (Platform.OS === 'android' || !atTop)
            ? {
                contentContainerStyle: {
                    paddingTop: headerHeight
                }
            }
            : {
                style: {
                    marginTop: headerHeight
                }
            }
        scrollProps.contentContainerStyle = [children.props.contentContainerStyle, scrollStyleProps.contentContainerStyle]
        scrollProps.style = [children.props.style, scrollStyleProps.style]

        return React.cloneElement(children, scrollProps)
    }
}


const s = StyleSheet.create({
    container: {
        flex: 1
    },

    header: {
        left: 0,
        position: 'absolute',
        right: 0,
        zIndex: 1,
    }
})
