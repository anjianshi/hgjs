import React from 'react'

/*
ReactNative only

https://facebook.github.io/react-native/docs/direct-manipulation.html
要将一个自定义 component 传给 TouchableHighlight / TouchableOpacity 作为 children 时，
这个自定义 component 必须实现向下传递 setNativeProps() 调用。

通过应用此 decorator，可以自动实现此行为。

限制：
自定义 component 只能返回单个 children；且不能给 children 指定 ref，因为这个 ref 会被 decorator 给覆盖掉。

其实还有一种解决办法是在自定义 component 外包裹一层 <View />，不过没有实际试过是否可行，
见：https://github.com/facebook/react-native/issues/1040#issuecomment-96745870
*/
export function emulateNative(Component) {
    return class EmulateNative extends Component {
        _emulateNativeRef = null

        setNativeProps = props => this._emulateNativeRef.setNativeProps(props)

        render() {
            // 这种从 children 中获取 ref 的方法灵感来自：https://facebook.github.io/react/docs/react-api.html#cloneelement
            const element = super.render()
            return <element.type {...element.props} ref={r => this._emulateNativeRef = r} />
        }
    }
}
