import { BackHandler } from 'react-native'


/*
通过此 HoC 方便地实现在用户按下 Android 设备的实体返回键时，由 component 决定是否要执行返回操作，且 component 可以异步地作出决定。
例如 component 如果是一个编辑界面，可以在用户试图返回时，先弹出一个对话框，询问用户是否真的要离开。
*/
export function confirmBack(Component) {
    return class ConfirmBack extends Component {
        static displayName = Component.displayName || Component.name

        componentWillMount() {
            if(super.componentWillMount) super.componentWillMount()
            BackHandler.addEventListener('hardwareBackPress', this._hgjsConfirmBack)
        }

        componentWillUnmount() {
            BackHandler.removeEventListener('hardwareBackPress', this._hgjsConfirmBack)
            if(super.componentWillUnmount) super.componentWillUnmount()
        }

        _hgjsConfirmBack = () => {
            const ret = this.confirmBack()
            if(typeof ret === 'boolean') return !ret

            ret.then(shouldBack => {
                if(shouldBack) {
                    // 若当前已经是第一个 route，则 goBack() 会返回 false，此时改为执行 exitApp()
                    const backResult = this.props.navigation.goBack()
                    if(!backResult) BackHandler.exitApp()
                }
            })
            return true
        }

        // confirmBack: bool | promise => bool
        // 若同意执行返回，返回 true；否则返回 false
        // 返回 promise 即可异步地作出决定
        confirmBack() {
            if(!super.confirmBack) throw new Error('confirmBack() not implemented')
            return super.confirmBack()
        }
    }
}
