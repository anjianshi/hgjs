/*
进行响应式设计的相关工具
*/

import React from 'react'
import { Platform, Dimensions } from 'react-native'
import { emulateNative } from 'native/component/emulateNative'


// 返回经过计算的当前窗口尺寸信息
export function getWindowData() {
    const rawValues = Dimensions.get('window')

    // Android 下，获取到的高度并没有把状态栏的高度给抛掉，因为大部分 Android 设备等状态栏高度都一样，所以这里就使用这个常数来修正
    // https://github.com/facebook/react-native/issues/8282
    // 另一篇可能有用的资料：http://stackoverflow.com/questions/35436643/how-to-find-height-of-status-bar-in-android-through-react-native
    const ANDRIOD_STATUS_HEIGHT = 24

    const width = rawValues.width
    const height = rawValues.height - (Platform.OS === 'android' ? ANDRIOD_STATUS_HEIGHT : 0)
    return {
        width,
        height,
        max: Math.max(width, height),
        min: Math.min(width, height),
        landscape: width >= height,
        portrait: height >= width,
    }
}


/*
responsiveObject
生成一个会根据窗口尺寸的变化实时更新其内容的 object。
可以利用此工具生成能动态更新的 StyleSheet 或是记录了公共样式内容（如字体大小）的 plain object。

虽然此 object 的内容能实时更新，但如果 component 不重新渲染，它还是无法利用上新生成的内容，因此大部分情况下应搭配 responsive hoc 使用。

生成动态 StyleSheet 的例子
responsiveObject(win => StyleSheet.create({
    mainView: {
        backgroundColor: '#fac',

        ...(win.width < 500 ? {
            width: 500
        } : {
            width: 1000
        }),
    }
}))

参数格式
factory(windowData) => {...object}
    传入当前的 window 尺寸，返回生成的 object；
    每当 window 尺寸变化时，会重新调用此函数；
    生成新对象后，不会用它代替之前的对象，而是会对原对象直接修改（清空原对象的所有 key，将新对象的 key 写入进去）
*/
export function responsiveObject(factory) {
    const object = factory(getWindowData())
    _registeredObjects.push({ factory, object })
    return object
}

const _registeredObjects = [
    // { factory, object }
]
Dimensions.addEventListener('change', () => {
    const windowData = getWindowData()
    for(const item of _registeredObjects) {
        const newObj = item.factory(windowData)

        for(const key of Object.keys(item.object)) {
            delete item.object[key]
        }

        Object.assign(item.object, newObj)
    }
})


/*
responsive hoc
用此 hoc 包裹 component，以使其能在窗口尺寸变化时重新渲染
此 component 会向原 component 传递一个 windowData props，以便那个 component 用它进行计算
*/
@emulateNative
export function responsive(Component) {
    return class Responsive extends React.Component {
        // 适配 react-navigation
        static navigationOptions = Component.navigationOptions

        state = { windowData: getWindowData() }

        componentWillMount() {
            Dimensions.addEventListener('change', this.updateData)
        }

        componentWillUnmount() {
            Dimensions.removeEventListener('change', this.updateData)
        }

        updateData = () => this.setState({ windowData: getWindowData() })

        render() {
            return <Component windowData={this.state.windowData} {...this.props} />
        }
    }
}
