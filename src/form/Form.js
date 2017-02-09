import React, { PropTypes } from 'react'
import { enhanceProps, reduxState, timer } from 'component'
import { isEmpty, isEqual, has, get, setWith, isPlainObject, pick } from 'lodash'
import { immuSet, immuDel, subtract, setWithObj } from 'lang'
import { scopeForEach, scopeSymbol } from './scopeStruct'
import { Validator, TextValidator } from './validator'
import { VALID, INVALID, TO_BE_CONFIRM, VALIDATING, TO_BE_VALID } from './constants'

/*
[表单类库技术细节](https://github.com/anjianshi/hgjs/blob/master/doc/form/表单类库技术细节.adoc)

此类库的多个地方都把 undefined 视为“no value”，因此，它实际上不支持把 undefined 作为字段值

this.props.xxx              definition
this.form / this.fields     instance
this.state.xxx              state
*/


@reduxState(props => ({
    key: 'form_' + props.name,
    initialState: {
        fields: {},     // scope struct
        status: VALID,
        submitting: false
    },
    cache: props.cache,
}))
@timer
@enhanceProps
export class Form extends React.Component {
    static propTypes = {
        // 此 form 的标识，必须整个应用内独一无二
        name: PropTypes.string.isRequired,
        cache: PropTypes.bool,

        /*
        格式： { name: config, ... } （scope struct）
        fields 可以动态增减。Form 会根据最新的 fields 列表来新增和移除 field callback / state。
        但不支持动态修改 field 定义。在 form 内部，field 的定义会一直维持在第一次读取时的状态，直到它被移除。

        使用者必须保证 form 从 redux store 中还原 state 时，传入的 fields 定义和离开时完全一致
        包括 fields 列表和各个 field 的 config。

        fields=null 或其他 falsy 值是允许的，和 fields={} 是同样的效果
        */
        fields: PropTypes.object,

        /*
        新增 field 时，会尝试从这里提取初始值。
        结构和 fields 一样，但不用设置 scopeSymbol。
        */
        initValues: PropTypes.object,

        // 见技术文档
        onChange: PropTypes.func,               // 此回调只在因用户的交互导致值变更时触发，以编程的形式调用 setValue() 不会触发此回调。
        onSubmit: PropTypes.func,
        submitWhenValid: PropTypes.bool,

        children: PropTypes.func.isRequired,    // (form) => rendered content
    }

    static defaultProps = {
        cache: false,
        submitWhenValid: false,
    }

    constructor(props) {
        super(props)

        this.form = null
        this.fields = null  // scope struct
    }

    componentDidLoadState() {
        const restore = !isEmpty(this.state.fields)
        this.initForm(restore)
    }

    componentWillClearState() { this.clearForm() }

    componentDidReceiveProps(prevProps) {
        if(this.props.name === prevProps.name
                && !isEqual(this.props.fields, prevProps.fields)) {
            this.updateFields()
        }
    }


    // ===========================================
    //                  actions
    // ===========================================

    // ========== form ==========

    action_submitting() { this.setState({ submitting: true }) }
    action_submitted() { this.setState({ submitting: false }) }
    action_submitCancelled() { this.setState({ submitting: false }) }

    // ========= fields =========

    action_addField(path, fieldState) {
        this.setState(immuSet(this.state, ['fields', ...path], fieldState, this.makeScope))

        if(fieldState.status === TO_BE_VALID && this.state.status === VALID) {
            this.setState({ status: TO_BE_CONFIRM })
        }
    }

    action_removeFields(paths) {
        const state = {...this.state}
        paths.forEach(path => {
            // 这里必须在 state.fields 下调用 immuDel()，不能直接在 state 下调用。
            // 不然一旦 fields 中一个 field 也没有，此方法会连 state.fields 也一起删除
            state.fields = immuDel(state.fields, path, true)
        })
        if(state.status !== true) {
            state.status = this.computeFormStatus(state)
        }
        this.setState(state)
    }

    action_fieldFocus(path) {
        this.setState(immuSet(this.state, ['fields', ...path, 'hasFocus'], true))
    }

    action_fieldBlurred(path) {
        const field = get(this.fields, path)
        const fieldState = get(this.state.fields, path)

        const updates = { hasFocus: false }
        if(fieldState.status === VALID) {
            updates.propsValue = this.toProps(fieldState.latestValidValue)
        } else if(fieldState.status === INVALID && field.config.restoreValid
                // 见下面 action_fieldValidated() 中的描述
                && fieldState.latestValidValue !== undefined && this.toProps(fieldState.latestValidValue) !== fieldState.propsValue) {
            Object.assign(updates, {
                status: VALID,
                propsValue: this.toProps(fieldState.latestValidValue),
                message: null,
            })
        }

        this.setState(immuSet(this.state, ['fields', ...path], {...fieldState, ...updates}))
    }

    action_fieldToBeValidated(path, value) {
        const fieldState = get(this.state.fields, path)
        const prevStatus = fieldState.status

        const updates = {
            status: TO_BE_VALID,
            message: null
        }
        if(value !== undefined) {
            updates.propsValue = value === null ? '' : value
        }

        let state = immuSet(this.state, ['fields', ...path], fieldState => ({...fieldState, ...updates}))
        state = this.fieldStatusChanged(state, prevStatus, fieldState.status)
        this.setState(state)
    }

    action_bizRuleValidating(path) {
        let fieldState = get(this.state.fields, path)
        const prevStatus = fieldState.status

        fieldState = {
            ...fieldState,
            status: VALIDATING,
            message: null
        }

        let state = immuSet(this.state, ['fields', ...path], fieldState)
        state = this.fieldStatusChanged(state, prevStatus, fieldState.status)
        this.setState(state)
    }

    action_bizRuleCancelled(path) {
        this.setState(immuSet(this.state, ['fields', ...path, 'status'], TO_BE_VALID))
    }

    action_fieldValidated(path, result) {
        const field = get(this.fields, path)
        let fieldState = get(this.state.fields, path)
        const prevStatus = fieldState.status

        let updates
        if(result.valid) {
            updates = {
                status: VALID,
                latestValidValue: result.value,
                message: null,
            }
            if(!fieldState.hasFocus) updates.propsValue = result.value === null ? '' : result.value
        } else if(!fieldState.hasFocus && field.config.restoreValid
                // 若在 latestValidValue === propsValue 的情况下判定字段不合法，说明当前不是因为字段值变更而触发的验证，
                // 而是因为依赖的字段更新了，或是提交表单时提交结果里标明此字段不合法
                // 这种情况下，latestValidValue 本身就相当于被判为不合法了，程序也不能找出一个合法值出来，
                // 所以没法实现 restoreValid，就让字段保留在 invalid 的状态。
                && fieldState.latestValidValue !== undefined && this.toProps(fieldState.latestValidValue) !== fieldState.propsValue) {
            updates = {
                status: VALID,
                propsValue: this.toProps(fieldState.latestValidValue),
                message: null,
            }
        } else {
            updates = {
                status: INVALID,
                message: result.message
            }
        }
        fieldState = {...fieldState, ...updates}

        let state = immuSet(this.state, ['fields', ...path], fieldState)
        state = this.fieldStatusChanged(state, prevStatus, fieldState.status)
        this.setState(state)
    }

    // 在某个 field 的 status 变化时，同步修改 form 的 status
    fieldStatusChanged(state, prevStatus, currStatus) {
        if(currStatus === prevStatus) { return state }

        let formStatus = state.status
        if(currStatus === INVALID) {
            formStatus = INVALID
        } else if(currStatus === TO_BE_VALID || currStatus === VALIDATING) {
            formStatus = formStatus === INVALID
                ? (prevStatus !== INVALID ? INVALID : this.computeFormStatus(state))
                : TO_BE_CONFIRM
        } else if(currStatus === VALID) {
            formStatus = this.computeFormStatus(state)
        }

        return {...state, status: formStatus}
    }

    computeFormStatus(state) {
        let status = VALID
        scopeForEach(state.fields, field => {
            status = field.status === INVALID
                ? INVALID
                : ((field.status === TO_BE_VALID || field.status === VALIDATING) ? TO_BE_CONFIRM : status)
            return status !== INVALID  // 一旦 status 变成 INVALID，就停止遍历
        })
        return status
    }

    // 将一个 value 转换成 react 能够正常处理的格式
    toProps(value) { return value === null ? '' : value }

    // ===========================================
    //                  methods
    // ===========================================

    // ========== form ==========

    initForm(restore=false) {
        this.form = {
            props: {
                onSubmit: this.formOnSubmit
            },
            submitPromise: null,
            latestValidValues: null,
            latestPropsValues: null,
        }
        this.fields = {}
        this.updateFields(restore ? 'restore' : 'init')
    }

    // 清理 instance 数据，并不会清除 state
    clearForm() {
        this.cancelSubmit()
        this.form = null
        this.fields = null
    }

    // latestValidValues: 若有值，说明是由 submitWhenValid 功能触发的提交。
    // 会将这个额外的值传给 onSubmit() 回调。
    // （之所以不直接读取 this.form.latestValidValues 进行传递，是因为此时那个值已经更新过，和当前 this.extractValues() 是同一个值了）
    submit = (latestValidValues=undefined) => {
        // 只在用户提供了 onSubmit 回调的情况下触发 submit 行为
        if(!this.props.onSubmit || this.state.status === INVALID) return

        this.batchedUpdates(() => {
            this.cancelSubmit()

            if(this.state.status !== VALID) {
                // 找出待验证的字段
                const fieldsToValidate = []
                scopeForEach(this.state.fields, (fieldState, path) => {
                    if(fieldState.status === TO_BE_VALID) fieldsToValidate.push(path)
                })
                this.getDepends(fieldsToValidate, true)
                    .forEach(path => this.validate(path, true))

                // 如有字段未能通过同步验证，终止提交
                if(this.state.status === INVALID) { return }

                // 终止正在运行的异步 bizRule，并将其状态设为 VALID
                scopeForEach(this.fields, (field, path) => {
                    if(field.bizRulePromise) {
                        const formattedValue = field.validatingValue
                        field.cancelBizRule()
                        this.action_fieldValidated(path, { valid: true, value: formattedValue })
                    }
                })
            }

            this.action_submitting()

            const values = this.extractValues()
            const result = latestValidValues === undefined ? this.props.onSubmit(values) : this.props.onSubmit(values, latestValidValues)
            if(!result || Array.isArray(result)) {
                this.submitted(result)
            } else {
                this.form.submitPromise = result
                this.form.submitPromise.then(result => {
                    this.form.submitPromise = null
                    this.submitted(result)
                })
            }
        })
    }

    submitted(result) {
        this.action_submitted()

        if(result) {
            for(const [path, validateResult] of result) {
                this.action_fieldValidated(path, validateResult)
            }
        }
    }

    cancelSubmit() {
        if(this.form.submitPromise) {
            this.form.submitPromise.cancel()
            this.form.submitPromise = null
            this.action_submitCancelled()
        }
    }

    // 若 submitWhenValid=true，检查 form 当前是否为 valid 状态，且 values 和之前比发生了变化。
    // 如果是，触发 submit() 操作。
    //
    // 目前会在添加 / 删除字段、用户更新字段值、编程更新字段值的情况下触发此行为；
    // 根据提交表单后得到的结果更新字段值导致的 valid 状态不会触发此行为。
    submitIfValid() {
        if(!this.props.submitWhenValid || this.state.status !== VALID) return
        const values = this.extractValues()
        const latestValidValues = this.form.latestValidValues
        if(!isEqual(values, latestValidValues)) {
            this.form.latestValidValues = values
            this.submit(latestValidValues)
        }
    }

    // ========== fields ==========

    /*
    mode:
        init        根据最新的 fields 列表生成 field instance 和 field state。
        update      将最新的 fields 列表和当前的 field instances 比对，建立缺少的 field instance 和 field state，移除多余 instance 和 state。
        restore     根据当前的 field 列表，重建 field instances（因为此状态下 field state 均以存在）。要求 field state 和 field 列表的内容要匹配。
    */
    updateFields(mode='update') {
        // 最新传入进来的 fields 列表
        const fieldConfigs = this.props.fields || {}

        const instanceOnly = mode === 'restore'    // add 的时候是否只添加 instance，不添加 state
        const fieldsToAdd = [/* [path, config, instanceOnly], ... */]
        const fieldsToRemove = [/* path */]

        if(mode === 'init' || mode === 'restore') {
            scopeForEach(fieldConfigs, (config, path) => fieldsToAdd.push([path, config, instanceOnly]))
        } else {
            const fieldInstances = this.fields

            scopeForEach(fieldConfigs, (config, path) => {
                if(!has(fieldInstances, path)) fieldsToAdd.push([path, config, instanceOnly])
            })

            scopeForEach(fieldInstances, (state, path) => {
                if(!has(fieldConfigs, path)) fieldsToRemove.push(path)
            })
        }

        if(!fieldsToAdd.length && !fieldsToRemove.length) return

        this.batchedUpdates(() => {
            this.cancelSubmit()
            this.addFields(fieldsToAdd, instanceOnly)
            this.removeFields(fieldsToRemove)
            this.submitIfValid()
        })
    }

    addFields(data, instanceOnly=false) {
        data.forEach(([path, config]) => {
            config = this.formatFieldConfig(config)
            setWith(this.fields, path, this.makeFieldInstance(path, config), nsValue => nsValue || this.makeScope())

            if(!instanceOnly) {
                const initValues = this.props.initValues
                const initValue = initValues ? get(initValues, path, null) : undefined
                const fieldState = this.makeFieldState(config, initValue)
                this.action_addField(path, fieldState)
            }
        })
    }

    removeFields(paths) {
        if(!paths.length) return
        const dependFieldPaths = this.getDepends(paths)

        paths.forEach(path => {
            this.cancelBizRule(path)
            this.clearValidateTimeout(path)
            this.fields = immuDel(this.fields, path, true)
        })
        this.action_removeFields(paths)

        dependFieldPaths.forEach(path => this.validate(path, true))
    }

    // values: [[path, value], ...]
    batchSetValues = (values) => {
        this.batchedUpdates(() => {
            for(const [path, value] of values) {
                this.setValue(path, value)
            }
        })
    }

    setValue = (path, value) => {
        const { hasFocus } = get(this.state.fields, path)
        this.batchedUpdates(() => {
            this.cancelSubmit()

            this.toBeValidated(path, value)
            // 在 field 没有 focus 的情况下调用了此方法，说明是以编程的形式进行的调用，因此立刻执行 validate。
            if(!hasFocus) this.validate(path)
        })
    }

    // byDepends: 是否是因当前字段依赖的那个字段更新了，而导致触发了此操作
    // 在 byDepends 为 false 的情况下，会对依赖于此字段的其他字段触发此操作
    toBeValidated(path, value, byDepends=false) {
        this.cancelBizRule(path)
        this.action_fieldToBeValidated(path, value)
        if(!byDepends) {
            this.getDepends([path])
                .forEach(path => this.toBeValidated(path, undefined, true))
        }
    }

    // byDepends: 是否是因当前字段依赖的那个字段更新了，而导致触发了此操作
    // 在 byDepends 为 false 的情况下，会对依赖于此字段的其他字段触发此操作
    validate(path, byDepends=false) {
        this.cancelSubmit()
        // 在设置了 validate timeout 的情况下，如因其他事件触发了对字段的验证，则取消 validate timeout。
        // 可能的事件包括：在 validate timeout 完成前， input onBlur 了，这时会立刻触发验证；
        // 或者用户输入完文字后，没有离开字段，直接按了回车，这时会触发表单提交。表单提交时，会对所有 valid=null 的字段进行验证。
        // 在设置了 timeout 的情况下，valid 是一定等于 null 的，因此那个设置了 timeout 并触发了表单提交的字段也会立刻被验证，它设置的 timeout 也就没有用、应该被取消了。
        this.clearValidateTimeout(path)
        this.cancelBizRule(path)

        const field = get(this.fields, path)
        const fieldState = get(this.state.fields, path)

        // 原本对于 byDepends=true 且 valid / validating 状态的字段，应该只运行 bizRule 跳过 validator 的。
        // 不过为了实现起来简单，现在总是会执行 validator 了。
        const result = field.config.validator.validate(fieldState.propsValue)
        if(result.valid && field.config.bizRule) {
            this.callBizRule(path, result.value)
        } else {
            this.action_fieldValidated(path, result)
        }

        if(!byDepends) {
            this.getDepends([path]).forEach(path => {
                // 为提升用户体验，因用户输入内容（而不是提交等其他原因）而触发对依赖于此字段的字段的验证时，
                // 对于那些用户还没输入过内容的字段，不执行验证，让它们保持在 toBeValid 的状态。
                // 这就像表单刚载入时不显示错误信息一样，是为了不要过早显示错误信息，引起用户的反感。
                const fieldState = get(this.state.fields, path)
                if(fieldState.latestValidValue === undefined && fieldState.propsValue === ''
                        && fieldState.status === TO_BE_VALID) {
                    return
                }

                this.validate(path, true)
            })
        }

        // 待相关字段的同步验证运行完后，再执行此操作
        this.submitIfValid()
    }

    callBizRule(path, formattedValue) {
        function valid(bizRuleformattedValue) {
            return {
                valid: true,
                value: (arguments.length === 0 ? formattedValue : bizRuleformattedValue),
            }
        }
        const invalid = (message) => ({valid: false, message})

        const field = get(this.fields, path)
        const result = field.config.bizRule(formattedValue, valid, invalid, this.state)
        if(isPlainObject(result)) {
            this.action_fieldValidated(path, result)
        } else {
            this.action_bizRuleValidating(path)
            field.validatingValue = formattedValue
            field.bizRulePromise = result
            field.bizRulePromise.then(result => this.batchedUpdates(() => {
                field.bizRulePromise = null
                field.formattedValue = null
                this.action_fieldValidated(path, result)
            }))
        }
    }

    cancelBizRule(path) {
        const field = get(this.fields, path)
        if(field.bizRulePromise) {
            field.bizRulePromise.cancel()
            field.bizRulePromise = null
            field.formattedValue = null
            this.action_bizRuleCancelled(path)
        }
    }

    clearValidateTimeout(path) {
        const field = get(this.fields, path)
        if(field.validateTimeoutId) {
            clearTimeout(field.validateTimeoutId)
            field.validateTimeoutId = null
        }
    }

    makeFieldState(config, initValue) {
        const hasInit = initValue !== undefined
        const hasDefault = config.default !== undefined
        const value = hasInit ? initValue : (hasDefault ? config.default : undefined)
        return {
            latestValidValue: value,
            propsValue: (value === null || value === undefined) ? '' : value,

            status: (hasInit || hasDefault) ? VALID : TO_BE_VALID,
            message: null,
            hasFocus: false,
        }
    }

    formatFieldConfig(rawConfig) {
        const config = {
            default: undefined,                 // undefined 代表没有默认值
            validator: new TextValidator(),
            bizRule: null,
            validateDelay: 200,
            restoreValid: false,
            depends: [],
        }

        if(rawConfig instanceof Validator) {
            config.validator = rawConfig
        } else if(isPlainObject(rawConfig)) {
            if(process.env.NODE_ENV === 'development') {
                const unexpectedKeys = subtract(Object.keys(rawConfig), Object.keys(config))
                if(unexpectedKeys.size) throw new Error('form field config 中出现了不应出现的 key: ' + [...unexpectedKeys].join(', '))
            }
            Object.assign(config, rawConfig)
        }

        return config
    }

    makeFieldInstance(path, config) {
        return {
            config,
            props: {
                onFocus: this.widgetOnFocus.bind(this, path),
                onChange: this.widgetOnChange.bind(this, path),
                onKeyPress: this.widgetOnKeyPress.bind(this, path),
                onBlur: this.widgetOnBlur.bind(this, path),

                // 非 web 环境下，没法通过与 input widget 交互（例如键入回车）来触发表单提交，
                // 因此额外提供一个回调，使得 input widget 可以在适当的时机通过它来触发提交。
                onSubmit: () => this.submit(),
            },
            validateTimeoutId: null,
            bizRulePromise: null,
            validatingValue: null,  // 字段值通过同步验证后得到的经过初步格式化的值，这个值会被传给 bizRule，且只在异步 bizRule 运行期间能读取到。
        }
    }

    makeScope() { return { [scopeSymbol]: true } }

    // 找出所有依赖于指定字段，或者和指定字段互相依赖的字段
    // 可以一次性指定多个字段，依赖于它们的所有字段都会被找出来
    //
    // 若 withSpecified 为 true，指定的字段本身也会出现在返回的列表里；为 false 则不会出现在列表中
    //
    // 此方法不会递归检索。
    // 例如 B 依赖于 A，C 依赖于 B，那么检索依赖于 A 的字段时，只有 B 会返回
    getDepends(paths, withSpecified=false) {
        const fields = new Set(paths.map(path => get(this.fields, path)))

        let nodeNames = []
        for(const field of fields) {
            nodeNames = nodeNames.concat(field.config.depends.filter(v => typeof v === 'string'))
        }
        nodeNames = new Set(nodeNames)

        // 当前的处理方式保证了 withSpecified=true 时，
        // resolvedPaths 对应的 field 即使不属于任何 group 也不会被排斥在 groupMembers 外面。
        const dependFieldPaths = withSpecified ? paths : []
        scopeForEach(this.fields, (field, path) => {
            if(fields.has(field)) return
            for(const target of field.config.depends) {
                if(typeof target === 'string') {
                    if(nodeNames.has(target)) {
                        dependFieldPaths.push(path)
                        return
                    }
                } else {
                    const targetField = get(this.fields, target)
                    if(fields.has(targetField)) {
                        dependFieldPaths.push(path)
                        return
                    }
                }
            }
        })

        return dependFieldPaths
    }

    extractValues(propsValue=false) {
        const values = {}
        scopeForEach(this.state.fields, (fieldState, path) =>
            setWithObj(values, path, propsValue ? fieldState.propsValue : fieldState.latestValidValue)
        )
        return values
    }

    // ===========================================
    //              UI event handler
    // ===========================================

    // ========== form ==========

    formOnSubmit = (event) => {
        event.preventDefault()
        this.submit()
    }

    // ========== fields ==========

    widgetOnFocus(path) { this.action_fieldFocus(path) }

    widgetOnChange(path, value) {
        this.batchedUpdates(() => {
            // 检查 value 是不是 react 的 SyntheticEvent 对象。
            // 因为开发时，hgzxjs 和使用 hgzxjs 的 module 会分别引入一份 react 实例，
            // 所以没法用 hgzxjs 引入的 SyntheticEvent 和 module 中用另一个 react 实例生成的 SyntheticEvent 进行比较，
            // 只能改为根据此对象的特征来识别（https://facebook.github.io/react/docs/events.html#syntheticevent）
            if(typeof value === 'object' && value !== null && 'nativeEvent' in value) {
                value = this._getValueFromEvent(value)
            }
            this.setValue(path, value)

            const field = get(this.fields, path)
            if(field.config.validateDelay === 0) {
                this.validate(path)
            } else if(field.config.validateDelay > 0) {
                this.clearValidateTimeout(path)

                field.validateTimeoutId = this.setTimeout(() => {
                    // 在 setTimeout 中执行的方法已经跳出了上面的 batchedUpdates 的 context，因此要重新开启
                    this.batchedUpdates(() => {
                        field.validateTimeoutId = null
                        this.validate(path)
                    })
                }, field.config.validateDelay)
            }

            if(this.props.onChange) {
                const latestPropsValues = this.extractValues(true)
                if(!isEqual(this.form.latestPropsValues, latestPropsValues)) {
                    this.form.latestPropsValues = latestPropsValues
                    this.props.onChange()
                }
            }
        })
    }

    // 有些 widget 与 此 component 进行了适配，传给事件回调的就是真正的字段值.
    // 而如果使用者把 field props 直接传给了普通的 HTML 元素，那么传进来的就是 event 对象，要尝试通过这个对象提取 value。
    _getValueFromEvent(event) {
        const target = event.target
        if(target.tagName.toUpperCase() === 'INPUT') {
            if(target.type === 'checkbox') {
                return target.checked
            } else if(target.type === 'radio') {
                return target.value
            }
        }
        return target.value
    }

    widgetOnKeyPress(path, event) {
        // 用户在文本框里按下回车时，也触发一次验证
        //
        // 虽然不知道为什么，如果一个字段之前不合法导致表单无法提交，现在改成合法值，但尚未经过验证，要验证后才能使“提交”按钮解除 disabled 状态，并允许表单提交。
        // 在这样的情况下，在这个字段里按下回车，居然能既触发验证，又在验证通过后能够触发提交。
        // 可能是这个 onKeyPress 事件的 handler 运行完成前，已经使得表单变得合法，然后立刻导致重新渲染、提交按钮解除禁用状态，
        // 然后浏览器才继续处理事件，把事件传递给了 form？
        if(event.charCode === 13) {
            this.batchedUpdates(() => this.validate(path))
        }
    }

    widgetOnBlur(path) {
        this.batchedUpdates(() => {
            this.action_fieldBlurred(path)

            const fieldState = get(this.state.fields, path)
            if(fieldState.status === TO_BE_VALID) this.validate(path)
        })
    }

    // ===========================================
    //              getters
    // ===========================================

    fieldConfig(path) {
        return this.formatFieldConfig(get(this.props.fields, path))
    }

    // ===========================================
    //                  interface
    // ===========================================

    render() {
        let form = null
        if(!isEmpty(this.state.fields)) {
            form = {
                props: this.form.props,
                ...pick(this.state, ['status', 'submitting']),
                ...pick(this, 'setValue', 'batchSetValues', 'submit'),

                // 提醒使用者不要沿用老 Form 的 valid 属性
                // 实际此属性也可以以 getter 的形式提供，使用者一访问就在 getter 函数里抛出异常
                // 但这样开发时进行 console.log() 也会导致抛出异常，不太方便，所以作罢
                valid: 'DO_NOT_USE'
            }

            const fields = {}
            scopeForEach(this.state.fields, (fieldState, path) => {
                const field = get(this.fields, path)

                const data = {
                    props: {
                        ...field.props,
                        value: fieldState.propsValue,
                    },

                    // 这是一个辅助读取 latestValidValue 的快捷方式
                    value: fieldState.status === VALID ? fieldState.latestValidValue : undefined,
                    ...pick(fieldState, 'latestValidValue', 'status', 'message', 'hasFocus'),

                    valid: 'DO_NOT_USE',
                }
                setWithObj(fields, path, data)
            })
            form.fields = fields
        }
        return this.props.children(form)
    }
}
