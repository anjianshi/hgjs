/*
进行响应式设计的相关工具
*/

import React from 'react'
import { Platform, Dimensions } from 'react-native'
import hoistNonReactStatic from 'hoist-non-react-statics'
import { emulateNative } from 'native/component/emulateNative'


// Android 下状态栏的高度。后面计算时会用到
// 因为大部分 Android 设备等状态栏高度都一样，所以这里直接定义为一个常量
export const ANDRIOD_STATUS_HEIGHT = 24

// iOS 下顶端状态栏的高度。目前所有设备上均为此值
export const IOS_STATUS_HEIGHT = 20


// 返回经过计算的当前窗口尺寸信息
export function getWindowData() {
    const rawValues = Dimensions.get('window')

    const width = rawValues.width

    // Android 下，获取到的高度并没有把状态栏的高度给抛掉，需要手动减去
    // https://github.com/facebook/react-native/issues/8282
    // 另一篇可能有用的资料：http://stackoverflow.com/questions/35436643/how-to-find-height-of-status-bar-in-android-through-react-native
    const height = rawValues.height - (Platform.OS === 'android' ? ANDRIOD_STATUS_HEIGHT : 0)

    const max = Math.max(width, height)
    const min = Math.min(width, height)

    const landscape = width > height
    const portrait = height > width

    // 当前设备是否是大尺寸设备
    // 对于 iOS，此值代表了当前设备是 iPhone 还是 iPad，见 http://iosres.com
    const big = max >= 1024

    const iOSStatusBarSize = Platform.OS === 'ios'
        ? (!big && landscape ? 0 : IOS_STATUS_HEIGHT)   // iPhone 横向显示时状态栏会隐藏
        : 0         // Android 下此值设为 0，以方便使用者进行不受平台影响的尺寸计算

    return {
        width, height,
        max, min,
        landscape, portrait,
        big,
        iOSStatusBarSize,
    }
}


/*
responsiveObject
生成一个会根据窗口尺寸的变化实时更新其内容的 object。
可以利用此工具生成能动态更新的 StyleSheet 或是记录了公共样式内容（如字体大小）的 plain object。

虽然此 object 的内容能实时更新，但如果 component 不重新渲染，它还是无法利用上新生成的内容，因此大部分情况下应搭配 responsive hoc 使用。

注意：不要把此工具生成的 object 直接传入 component 的 style 属性。因为 react-native 会在一些情况下（如旋转设备）将传入 style 的 object 给 fronze，
导致后续无法继续对 object 进行更新。


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


export function responsiveStyleSheet(factory) {

}




/*
responsive hoc
用此 hoc 包裹 component，以使其能在窗口尺寸变化时重新渲染
此 component 会向原 component 传递一个 windowData props，以便那个 component 用它进行计算
*/
export function responsive(Component) {
    @emulateNative
    class Responsive extends React.Component {
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

    return hoistNonReactStatic(Responsive, Component)
}
