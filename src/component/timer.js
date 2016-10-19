/*
向 component 提供 setTimeout 和 setInterval 方法，并在 component unmount 时自动移除未结束的 timeout 和 interval
*/
export function timer(Component) {
    class WithTimer extends Component {
        componentWillMount() {
            this.timeoutIds = []
            this.intervalIds = []

            if(super.componentWillMount) super.componentWillMount()
        }

        componentWillUnmount() {
            if(super.componentWillUnmount) super.componentWillUnmount()

            this.timeoutIds.forEach(id => clearTimeout(id))
            this.intervalIds.forEach(id => clearInterval(id))
        }

        setTimeout(fn, delay) {
            const id = setTimeout(fn, delay)
            this.timeoutIds.push(id)
            return id
        }

        setInterval(fn, delay) {
            const id = setInterval(fn, delay)
            this.intervalIds.push(id)
            return id
        }
    }
    WithTimer.displayName = Component.displayName || Component.name
    return WithTimer
}
