import React, { PropTypes } from 'react'
import { connect } from 'react-redux'
import { extraProps } from 'component'
import { shallowEqual } from 'lang'
import { FormBiz } from './instance'


@connect(
    (state, props) => ({ _state: FormBiz.getState(props.name) })
)
export class FormComponent extends React.Component {
    static propTypes = {
        // 此 form 的标识，必须整个应用内独一无二
        name: PropTypes.string.isRequired,

        /*
        form component unmount 后，是否要保留 form state / instance

        大部分情况下，form 不需要 cache，form component 被移除时，就让 form state 也跟着移除。
        然后下次使用者需要使用 form component 时，再重新构建它。

        个别情况下，可能确实希望保留 state，例如一个复杂的编辑型界面，用户有可能在某些字段里输入了不合法的内容，这会影响 form state。
        如果使用者希望在离开页面并回来后，这些不合法的内容及状态也能被还原回来，那就需要 cache 整个 form 的 state。
        因为光靠 defaultValue 是没办法还原回不合法的值的。
        */
        cache: PropTypes.bool,

        // 此 component 会把经过整理的 form object 传递给 children，children 必须是一个函数。
        // (form) => rendered content
        children: PropTypes.func.isRequired,

        // 为了能在 form state 发生更新时重新渲染，需要通过 react-redux 把 form state 引入此 component（虽然在这个 component 里并没有用上它）
        // 为了避免从 props 中提取 form config 时误把 state 也包括进去，所以这里要对 state props 进行定义，这样它就不会被包括在 form config 里面了。
        _state: PropTypes.any,

        // 其他 props 均视为是 form config，其格式详见 functional.js
    }

    static defaultProps = {
        cache: false,
        _state: null,
    }

    componentWillMount() {
        this.initForm()
    }

    componentWillReceiveProps(nextProps) {
        if(nextProps.name !== this.props.name) {
            this.clearForm(this.props.cache)
            this.initForm(nextProps)
        } else {
            const prevConfig = extraProps(this, this.props)
            const newConfig = extraProps(this, nextProps)
            if(!shallowEqual(prevConfig, newConfig)) {
                this.instance.configUpdated(newConfig)
            }
        }
    }

    componentWillUnmount() {
        if(!this.props.cache) {
            this.clearForm()
        }
    }

    // ============================

    instance = null

    initForm(props) {
        if(!props) props = this.props
        this.instance = FormBiz.getInstance(props.name, extraProps(this, props))
    }

    clearForm(destory=true) {
        if(destory) this.instance.destory()
        this.instance = null
    }

    render() {
        return this.props.children(this.instance.getFormObj())
    }
}
