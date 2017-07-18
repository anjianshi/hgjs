import React from 'react'
import PropTypes from 'prop-types'
import { Image } from 'react-native'

/*
在图片载入过程中和载入失败时显示一个代替的内容

<ProgressImage
    loading={loadingElement}
    failed={failedElement}
>
    <Image source={xxx} />
</ProgressImage>
*/
export class ProgressImage extends React.Component {
    static propTypes = {
        loading: PropTypes.element.isRequired,      // 图片载入中时显示此 element
        failed: PropTypes.element.isRequired,       // 图片载入失败时显示此 element
        children: PropTypes.element.isRequired,     // 最终要显示的 element。必须是 <Image> like element，即要有 source props
    }

    constructor(props) {
        super(props)

        this.state = {
            status: typeof this.getSource(props) === 'number' ? 'loaded' : 'loading'
        }
    }

    componentWillMount() {
        if(this.state.status !== 'loaded') {
            Image.getSize(this.getSource(this.props).uri, this.loaded, this.failed)
        }
    }

    componentWillUnmount() {
        this.unmounted = true
    }

    getSource(props) { return props.children.props.source }
    loaded = () => !this.unmounted && this.setState({ status: 'loaded' })
    failed = () => !this.unmounted && this.setState({ status: 'failed' })

    render() {
        const { status } = this.state
        return status === 'loaded'
            ? this.props.children
            : (status === 'loading' ? this.props.loading : this.props.failed)
    }
}
