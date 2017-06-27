import { BackHandler, Alert } from 'react-native'
import hoistNonReactStatic from 'hoist-non-react-statics'


/*
App 中有一些页面（主要是编辑类的）在进行离开页面的操作时，需要先向用户确认，然后才能决定是否真的要离开。
通过此 HoC，可以方便地实现此行为。
使用者只需把判断逻辑写在 confirmGoBack() 方法里即可（例如弹出一个对话框，询问用户是否真的要离开，然后把用户做出的选择作为返回值），其余工作会由此工具自动处理。

此工具还能响应 Android 下的实体返回键，当用户按下返回键时，也会先进行确认，才决定是否要离开页面。

此工具需搭配 react-navigation 使用

使用了此工具的 view，必须保证不会再进一步进入其他页面，在操作完成时，只能 goBack() 返回上一页。
因为在 StackNavigator 里，进入下一页时，上一页的 component 不会 unmount，此工具注册的 BackHandler listener 也就不会取消注册，
那么用户在下一页里按返回键，就会误触发此页面的回调。
目前还没有找到办法，能在 StackNavigator 里 stack 变换时收到回调通知，因此做不到在 stack 变换时移除／重新注册 listener。
*/
export function confirmGoBack(Component) {
    class ConfirmGoBack extends Component {
        static displayName = Component.displayName || Component.name

        componentWillMount() {
            if(super.componentWillMount) super.componentWillMount()
            BackHandler.addEventListener('hardwareBackPress', this.goBack)
        }

        componentWillUnmount() {
            BackHandler.removeEventListener('hardwareBackPress', this.goBack)
            if(super.componentWillUnmount) super.componentWillUnmount()
        }

        // Android 下，用户按下实体返回键会自动触发此函数
        // 当需要手动执行返回操作时（例如在页面上放了一个“返回”链接，然后用户点了它），只需手动调用此方法即可。
        goBack = () => {
            const ret = this.confirmGoBack()
            const promise = typeof ret === 'boolean' ? Promise.resolve(ret) : ret

            promise.then(shouldBack => {
                if(shouldBack) {
                    // 若当前已经是第一个 route，则 goBack() 会返回 false，此时改为执行 exitApp()
                    const backResult = this.props.navigation.goBack()
                    if(!backResult) BackHandler.exitApp()
                }
            })

            // goBack 也被作为 hardwareBackPress event 的回调，
            // 返回 true 可以使上级回调不再被调用，完全由 goBack() 自己控制后续行为
            return true
        }

        // 返回是否允许离开页面，若同意执行返回，返回 true；否则返回 false
        // 通过返回 promise 可异步地作出决定
        // confirmGoBack: bool | promise => bool
        confirmGoBack() {
            // 使用者未定义
            if(!super.confirmGoBack) throw new Error('confirmGoBack() not implemented')
            return super.confirmGoBack()
        }

        // 一个工具函数，弹出一个对话框来确认用户是否要离开页面。
        // 使用者可以调用这个函数来辅助进行判断
        alertConfirmGoBack(title, message, cancelText, confirmText) {
            return new Promise(resolve => {
                Alert.alert(
                  title || '确定要离开吗？',
                  message || null,
                  [
                    {text: cancelText || '留在页面', onPress: () => resolve(false)},
                    {text: confirmText || '离开', onPress: () => resolve(true)},
                  ],
                  { onDismiss: () => resolve(false) }
                )
            })
        }
    }
    return hoistNonReactStatic(ConfirmGoBack, Component)
}
