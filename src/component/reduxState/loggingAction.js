const style = 'color: #165be3;'
let no = 1

export function wrapActionCreator(componentInst, stateKey, methodName, origMethod) {
    return function actionCreatorWithLogger(...args) {
        // 通过这个 no 可以跟踪 action 的发生顺序。
        // 当 action 中出现嵌套时，例如 action a 调用 action b，因为 action b 会比 action a 先结束，所以它的日志信息也会先出现
        // 这样一来 action 之间究竟是谁先运行的就搞不清楚了，这时就可以根据这个 no 来判断。
        const currNo = no++

        const date = new Date()
        const timeStr = date.getHours() + ':' + date.getMinutes() + ':' + date.getSeconds() + '.' + date.getMilliseconds()
        const prevState = {...componentInst.state}

        // 这里的 this 有可能是 component instance，也有可能不是。
        // 我们不去管它，就把它原样传给 origMethod，由原 component 自己负责处理。
        const result = origMethod.apply(this, args) // eslint-disable-line no-invalid-this

        // 注意，因为 React 的 state 并不是实时更新的，所以 prev / current state 未必能反应此时的真实情况
        console.groupCollapsed(`%c${currNo} localAction @ ${timeStr} ${stateKey} :: ${methodName}`, style)
        console.debug('arguments', ...args)
        console.debug('prev state', prevState)
        console.debug('current state', componentInst.state)
        console.groupEnd()

        return result
    }
}
