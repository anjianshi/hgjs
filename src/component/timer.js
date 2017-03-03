/*
对 setTimeout 和 setInterval 进行托管，
当使用者（利用 app 里的一个模块）决定停止运行时，可一次性将尚未触发 / 终止的 timeout 和 interval 全部取消。

使用范例：
const host = makeTimerHost()

host.setTimeout(...)
host.setInterval(...)

...

host.clear()
*/
export function makeTimerHost() {
    let timeouts = []
    let intervals = []

    function hostedSetTimeout(...args) {
        const id = setTimeout(...args)
        timeouts.push(id)
        return id
    }

    function hostedSetInterval(...args) {
        const id = setInterval(...args)
        intervals.push(id)
        return id
    }

    function clear() {
        for(const id of timeouts) clearTimeout(id)
        timeouts = []

        for(const id of intervals) clearInterval(id)
        intervals = []
    }

    return {
        setTimeout: hostedSetTimeout,
        setInterval: hostedSetInterval,
        clear
    }
}


// 此 decorator 会为 component 绑定一个 timer host，在 component unmount 时自动对 timer 进行 clear
export function timer(Component) {
    class WithTimer extends Component {
        static displayName = Component.displayName || Component.name

        constructor(props) {
            super(props)

            // 因为一个 component 可能会有多个实例（在同一个页面内多次出现），
            // 因此必须为每个实例单独创建 host，而不能在全局范围内创建
            this._timerHost = makeTimerHost()
        }

        componentWillUnmount() {
            if(super.componentWillUnmount) super.componentWillUnmount()
            this._timerHost.clear()
        }

        setTimeout(...args) {
            return this._timerHost.setTimeout(...args)
        }

        setInterval(...args) {
            return this._timerHost.setInterval(...args)
        }
    }
    return WithTimer
}
