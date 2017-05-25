import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { View } from 'react-native'
import { responsive } from 'native/responsive'


/*
让未指定宽度的 component 能在父元素中横向居中对齐

在 ReactNative 里，要让一个元素居中，我们一般会在父元素里设置 alignItems: center
但这一样式用于某些特殊元素（例如 TextInput）时会出现问题，这些元素的宽度会塌缩（因为它们不像 Text 那样内部又内容能将宽度撑起来）

通过为这些特殊元素明确指定宽度可以解决此问题，但在大部分情况下，我们会希望这些元素自适应宽度，以适配不同尺寸的设备。
此时，就可以使用此元素，它会检测子元素在自然情况下的实际宽度，然后通过设置 padding 来使其居中。
注意：使用此元素时，父元素不能指定 alignItems: center
*/

@responsive
export class Central extends Component {
    static propTypes = {
        children: PropTypes.element.isRequired,
    }

    state = {
        containerWidth: null,
        childrenWidth: null
    }

    get childrenProps() { return this.props.children.props }

    containerOnLayout = e => {
        this.setState({ containerWidth: e.nativeEvent.layout.width })
    }

    childrenOnLayout = e => {
        const prevOnLayout = this.childrenProps.onLayout
        if(prevOnLayout) prevOnLayout(e)

        this.setState({ childrenWidth: e.nativeEvent.layout.width })
    }

    render() {
        const { containerWidth, childrenWidth } = this.state
        const leftSpace = containerWidth !== null && childrenWidth !== null
            ? Math.round((containerWidth - childrenWidth) / 2)
            : 0

        const children = React.cloneElement(
            this.props.children,
            { onLayout: this.childrenOnLayout },
        )

        return <View onLayout={this.containerOnLayout} style={{ paddingLeft: leftSpace }}>{children}</View>
    }
}
