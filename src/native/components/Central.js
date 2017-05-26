import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { View } from 'react-native'
import { responsive } from 'native/responsive'


/*
让未明确指定宽度的元素能横向居中

在 ReactNative 里，要让一个元素居中，我们一般会在父元素里设置 "alignItems: center"。

但这种居中方式是有局限的，像 TextInput 这样的元素，在未明确指定宽度的情况下，它自身是没有宽度的，
一旦设置了 alignItems，它的宽度就会塌陷为 0 或 minWidth，而不会再向外扩展。
（一般对于 TextInput，我们会给它设置一个 maxWidth，希望它任意向外扩展，除非达到 maxWidth，然后再居中对齐）

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
