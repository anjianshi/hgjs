import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { View } from 'react-native'
import { responsive } from 'native/responsive'


/*
让未明确指定宽度的元素能横向居中

在 ReactNative 里，要让一个元素居中，我们一般会在父元素里设置 "alignItems: center"。
但这种居中方式是有局限的，对于那些没有明确指定宽度、希望它们尽可能向外扩宽的元素（例如 TextInput、Button），一旦设置了 alignItems，
它们的宽度就会塌陷，而不会再向外扩展。

此时，就可以使用此元素，它会检测子元素在自然情况下的实际宽度，然后通过设置 padding 来使其居中。
注意：使用此元素时，此元素的父元素不能指定 alignItems: center
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
