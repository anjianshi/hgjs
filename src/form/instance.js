import { registerSimpleReducer } from 'store'
import { libReducerHost } from 'init'
import { shallowEqual, immuSet, immuDel, setWithObj } from 'lang'
import { has, get, isPlainObject, isEqual, flatMap, pick } from 'lodash'
import { makeTimerHost } from 'hosts'
import {
    VALID, INVALID, TO_BE_CONFIRM, VALIDATING, TO_BE_VALID,
    formState as makeFormState, fieldState as makeFieldState,
    formConfig as formatFormConfig, fieldConfig as formatFieldConfig
} from './standard'
import { scopeSymbol, scopeItems } from './scopeStruct'


// state: { formName: formState }
const reducerNode = registerSimpleReducer(libReducerHost, 'hgjs.form', {})

function batchedUpdates(callback) {
    return reducerNode.getStore().batchedUpdates(callback)
}

/*
FormBiz 公开接口（其他接口不应私自调用）：
    static getInstance()

    configUpdated()
    destory()
    getFormObj()

getFormObj() 生成的 form object 的接口见其注释。
*/
export class FormBiz {
    // { formName: instance }
    static _instances = {}

    // 获取 form instance。若此 instance 尚不存在则创建它
    static getInstance(name, config) {
        let instance
        if(name in FormBiz._instances) {
            instance = FormBiz._instances[name]
            // 此时的 config 有可能和最后一次使用 instance 时发生了变化，所以这里要更新一下。
            instance.configUpdated(config)
        } else {
            batchedUpdates(() => {
                instance = new FormBiz(name, config)
            })
            FormBiz._instances[name] = instance
        }
        return instance
    }

    static removeInstance(name) {
        delete FormBiz._instances[name]
    }

    static getState(name) {
        return reducerNode.getState()[name]
    }


    // =============================================

    config = null

    // 为了方便读取，在这里建立一个 form state 的实时镜像
    state = null

    setState(...args) {
        const [describe, updates] = args.length === 1 ? [null, args[0]] : args
        this.state = {...this.state, ...updates}
        reducerNode.setState(describe, { [this.name]: this.state })
    }

    clearState() {
        const fullState = {...reducerNode.getState()}
        delete fullState[this.name]
        reducerNode.replaceState('clear', fullState)
    }

    // form data
    form = null

    initFormData() {
        this.form = {
            submitPromise: null,
            latestValidValues: null,
            latestPropsValues: null,

            eventHandlers: {
                onSubmit: this.formOnSubmit
            },
        }
    }

    // fields data
    fields = {}

    makeFieldData(path, config) {
        return {
            config,
            validateTimeoutId: null,
            bizRulePromise: null,
            validatingValue: null,

            // 把这些内容提前在这里定义好，这样就不用每次生成 form obj 时，都重新生成 method 了
            eventHandlers: {
                onFocus: this.widgetOnFocus.bind(null, path),
                onChange: this.widgetOnChange.bind(null, path),
                onKeyPress: this.widgetOnKeyPress.bind(null, path),
                onBlur: this.widgetOnBlur.bind(null, path),

                // 非 web 环境下，没法通过与 input widget 交互（例如键入回车）来触发表单提交，
                // 因此额外提供一个回调，使得 input widget 可以在适当的时机通过它来触发提交。
                onSubmit: () => this.submit(),
            },
            methods: {
                setValue: value => this.setValue(path, value),
            }
        }
    }

    // 不应直接构建此类的实例，而应通过 FormBiz.getInstance() 来获取。
    constructor(name, config) {
        this.name = name
        this.timerHost = makeTimerHost()

        // init state
        const fullState = reducerNode.getState()
        if(this.name in fullState) {
            this.state = reducerNode.getState()[this.name]
        } else {
            this.setState('init', makeFormState())
        }

        // init form
        this.initFormData()
        this.configUpdated(config)
    }

    // 销毁当前 form instance 并清空 form state。
    // 调用此函数后，应立即抛弃 form instance 对象，不应再用其进行任何操作。
    destory() {
        this.timerHost.clear()

        // 终止所有正在进行的异步行为
        this.cancelSubmit()
        for(const [field] of scopeItems(this.fields)) {
            if(field.bizRulePromise) {
                field.bizRulePromise.cancel()
            }
        }

        this.clearState()

        FormBiz.removeInstance(this.name)
    }


    // ========== form methods ==========

    // 当需要更新 form config 时，调用此方法
    configUpdated(newRawConfig) {
        const prev = this.config || {}
        this.config = formatFormConfig(newRawConfig)

        if(!shallowEqual(prev.fields, this.config.fields)) {
            this.updateFields()
        }
    }

    updateFields() {
        const fieldConfigs = this.config.fields

        // [ [path, config], ...]
        const fieldsToAdd = Array.from(scopeItems(fieldConfigs))
            .filter(([, path]) => !has(this.fields, path))
            .map(([item, path]) => [path, item])

        // [ path, ...]
        const fieldsToRemove = Array.from(scopeItems(this.fields))
            .filter(([, path]) => !has(fieldConfigs, path))
            .map(([, path]) => path)

        if(!fieldsToAdd.length && !fieldsToRemove.length) return

        batchedUpdates(() => {
            this.cancelSubmit()
            if(fieldsToAdd.length) this._addFields(fieldsToAdd)
            if(fieldsToRemove.length) this._removeFields(fieldsToRemove)
            this.submitIfValid()
        })
    }
    _addFields(configs) {
        let state = this.state

        for(let [path, fieldConfig] of configs) {    // eslint-disable-line prefer-const
            fieldConfig = formatFieldConfig(fieldConfig)
            this.fields = immuSet(this.fields, path, this.makeFieldData(path, fieldConfig), makeScope)

            if(!has(state.fields, path)) {
                const initValue = this.config.initValues ? get(this.config.initValues, path, null) : undefined
                const fieldState = makeFieldState(fieldConfig, initValue)

                state = immuSet(state, ['fields', ...path], fieldState, makeScope)
                if(fieldState.status === TO_BE_VALID && this.state.status === VALID) {
                    state = immuSet(state, ['status'], TO_BE_CONFIRM)
                }
            }
        }

        this.setState('addFields', state)
    }
    _removeFields(paths) {
        const dependFieldPaths = this.getDepends(paths)
        for(const path of paths) {
            this.cancelBizRule(path)
            this.clearValidateTimeout(path)
            this.fields = immuDel(this.fields, path, true)
        }

        const updates = {...this.state}
        for(const path of paths) {
            // 这里必须在 updates.fields 下调用 immuDel()，不能直接在 updates 下调用。
            // 不然一旦 fields 中一个 field 也没有，此方法会连 updates.fields 也一起删除
            updates.fields = immuDel(updates.fields, path, true)
        }
        if(updates.status !== true) {
            updates.status = this.computeFormStatus(updates)
        }
        this.setState('removeFields', updates)

        dependFieldPaths.forEach(path => this.validate(path, true))
    }

    // latestValidValues: 若有值，说明是由 submitWhenValid 功能触发的提交。
    // 会将这个额外的值传给 onSubmit() 回调。
    // （之所以不直接读取 this.form.latestValidValues 进行传递，是因为此时那个值已经更新过，和当前 this.extractValues() 是同一个值了）
    submit = (latestValidValues=undefined) => {
        // 只在用户提供了 onSubmit 回调的情况下触发 submit 行为
        if(!this.config.onSubmit || this.state.status === INVALID) return

        batchedUpdates(() => {
            this.cancelSubmit()

            if(this.state.status !== VALID) {
                // 找出待验证的字段
                const fieldsToValidate = Array.from(scopeItems(this.state.fields))
                    .filter(([fieldState]) => fieldState.status === TO_BE_VALID)
                    .map(([, path]) => path)

                this.getDepends(fieldsToValidate, true)
                    .forEach(path => this.validate(path, true))

                // 如有字段未能通过同步验证，终止提交
                if(this.state.status === INVALID) { return }

                // 终止正在运行的异步 bizRule，并将其状态设为 VALID
                for(const [field, path] of scopeItems(this.fields)) {
                    if(field.bizRulePromise) {
                        const formattedValue = field.validatingValue
                        this.cancelBizRule(path)
                        this.validated(path, { valid: true, value: formattedValue })
                    }
                }
            }

            this.setState('submitting', { submitting: true })

            const values = this.extractValues()
            const result = latestValidValues === undefined ? this.config.onSubmit(values) : this.config.onSubmit(values, latestValidValues)
            if(!result || Array.isArray(result)) {
                this.submitted(result)
            } else if(result.isFulfilled()) {
                /*
                若 promise 已经 fulfilled，一定要直接将其结果提取并传给 this.submitted()，而不能再走 promise.then() 的流程，不然在特殊情况下会出现错乱。

                bluebird Promise 的 cancel 机制有这样一条规则：
                对已经 fulfilled 的 promise 执行 cancel() 不会有任何效果，在 cancel 前和 cancel 后注册的 then() 回调都会被正常调用。
                且因为 then() 回调里的内容会在下一个 stack 里执行，所以：“在 cancel() 之前注册的 then() 回调不会被取消，且会在 cancel() 后开始运行”

                这在 Form 上下文里就会导致问题：
                如果 Form component 在 submit 完成前被 unmount，那么 submit promise 的 then() 回调会等到 form destory（cancelSubmit）执行完之后才被调用，
                原本 form state 在 destory 时应该已经被清空了的，但是 destory 后才运行的 then() 回调会因触发 submitted() 操作而把 state 又原样还原回去。
                */
                this.submitted(result.value())
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
        this.setState('submitted', { submitting: false })

        if(result) {
            for(const [path, validateResult] of result) {
                this.validated(path, validateResult)
            }
        }
    }

    cancelSubmit() {
        if(this.form.submitPromise) {
            this.form.submitPromise.cancel()
            this.form.submitPromise = null

            this.setState('cancelSubmit', { submitting: false })
        }
    }

    // 若 submitWhenValid=true，检查 form 当前是否为 valid 状态，且 values 和之前比发生了变化。
    // 如果是，触发 submit() 操作。
    //
    // 目前会在添加 / 删除字段、用户更新字段值、编程更新字段值的情况下触发此行为；
    // 根据提交表单后得到的结果更新字段值导致的 valid 状态不会触发此行为。
    submitIfValid() {
        if(!this.config.submitWhenValid || this.state.status !== VALID) return
        const values = this.extractValues()
        const latestValidValues = this.form.latestValidValues
        if(!isEqual(values, latestValidValues)) {
            this.form.latestValidValues = values
            this.submit(latestValidValues)
        }
    }

    // 在某个 field 的 status 变化后，计算出新的 form status
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
        for(const [field] of scopeItems(state.fields)) {
            status = field.status === INVALID
                ? INVALID
                : ((field.status === TO_BE_VALID || field.status === VALIDATING) ? TO_BE_CONFIRM : status)
            if(status === INVALID) break
        }
        return status
    }

    // 生成一个供使用者使用的 object，里面整合了 form instance 和 form state 信息
    getFormObj() {
        // 目前的实现里，每次调用此函数，部分 object 都会重新生成，例如 form.props，这有可能潜在地影响性能。
        // 之后注意观察，如果发现确实有影响，则改进此实现，对这类 object 进行 cache，使得 object 只被生成一次，以后都直接提取 cache。
        const formObj = {
            ...pick(this.state, ['status', 'submitting']),
            ...pick(this, 'setValue', 'batchSetValues', 'submit'),
            props: this.form.eventHandlers,

            // 提醒使用者不要沿用老 Form 的 valid 属性
            // 实际此属性也可以以 getter 的形式提供，使用者一访问就在 getter 函数里抛出异常
            // 但这样开发时进行 console.log() 也会导致抛出异常，不太方便，所以作罢
            valid: 'DO_NOT_USE'
        }

        const fields = {}
        for(const [fieldState, path] of scopeItems(this.state.fields)) {
            const field = get(this.fields, path)
            const data = {
                // 这是一个辅助读取 latestValidValue 的快捷方式
                value: fieldState.status === VALID ? fieldState.latestValidValue : undefined,
                ...pick(fieldState, 'latestValidValue', 'status', 'message', 'hasFocus'),
                ...field.methods,

                props: {
                    value: fieldState.propsValue,
                    ...field.eventHandlers
                },

                valid: 'DO_NOT_USE',
            }
            setWithObj(fields, path, data)
        }
        formObj.fields = fields

        return formObj
    }


    // ========== field methods ==========

    // values: [[path, value], ...]
    batchSetValues = (values) => {
        batchedUpdates(() => {
            for(const [path, value] of values) {
                this.setValue(path, value)
            }
        })
    }

    setValue = (path, value) => {
        const { hasFocus } = get(this.state.fields, path)
        batchedUpdates(() => {
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

        // 更新 state
        const fieldState = get(this.state.fields, path)
        const prevStatus = fieldState.status

        const updates = {
            status: TO_BE_VALID,
            message: null,
        }
        if(value !== undefined) {
            updates.propsValue = value === null ? '' : value
            updates.everHadValue = true
        }

        let state = immuSet(this.state, ['fields', ...path], fieldState => ({...fieldState, ...updates}))
        state = this.fieldStatusChanged(state, prevStatus, TO_BE_VALID)
        this.setState('toBeValidated', state)

        // 更新依赖字段的状态
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
            this.validated(path, result)
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
            this.validated(path, result)
        } else {
            this.bizRuleValidating(path)
            field.validatingValue = formattedValue
            field.bizRulePromise = result
            field.bizRulePromise.then(result => batchedUpdates(() => {
                field.bizRulePromise = null
                field.formattedValue = null
                this.validated(path, result)
            }))
        }
    }

    bizRuleValidating(path) {
        let fieldState = get(this.state.fields, path)
        const prevStatus = fieldState.status

        fieldState = {
            ...fieldState,
            status: VALIDATING,
            message: null
        }

        let state = immuSet(this.state, ['fields', ...path], fieldState)
        state = this.fieldStatusChanged(state, prevStatus, fieldState.status)
        this.setState('bizRuleValidating', state)
    }

    cancelBizRule(path) {
        const field = get(this.fields, path)
        if(field.bizRulePromise) {
            field.bizRulePromise.cancel()
            field.bizRulePromise = null
            field.formattedValue = null

            this.setState('cancelBizRule', immuSet(this.state, ['fields', ...path, 'status'], TO_BE_VALID))
        }
    }

    clearValidateTimeout(path) {
        const field = get(this.fields, path)
        if(field.validateTimeoutId) {
            clearTimeout(field.validateTimeoutId)
            field.validateTimeoutId = null
        }
    }

    validated(path, result) {
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
        this.setState('validated ' + path.join('.'), state)
    }

    blurred(path) {
        const field = get(this.fields, path)
        const fieldState = get(this.state.fields, path)

        const updates = { hasFocus: false }
        if(fieldState.status === VALID) {
            updates.propsValue = this.toProps(fieldState.latestValidValue)
        } else if(fieldState.status === INVALID && field.config.restoreValid
                // 见 this.validated() 中的描述
                && fieldState.latestValidValue !== undefined && this.toProps(fieldState.latestValidValue) !== fieldState.propsValue) {
            Object.assign(updates, {
                status: VALID,
                propsValue: this.toProps(fieldState.latestValidValue),
                message: null,
            })
        }

        this.setState('blurred', immuSet(this.state, ['fields', ...path], {...fieldState, ...updates}))
    }

    // 找出所有依赖于指定字段，或者和指定字段互相依赖的字段
    // 可以一次性指定多个字段，依赖于它们的所有字段都会被找出来
    //
    // 若 withSpecified 为 true，指定的字段本身也会出现在返回的列表里；为 false 则不会出现在列表中
    //
    // 此方法不会递归检索。
    // 例如 B 依赖于 A，C 依赖于 B，那么检索依赖于 A 的字段时，只有 B 会返回
    getDepends(paths, withSpecified=false) {
        const fields = new Set(paths.map(path => get(this.fields, path)))
        const nodeNames = new Set(
            flatMap(fields, field => field.config.depends.filter(v => typeof v === 'string'))
        )

        // 当前的处理方式保证了 withSpecified=true 时，
        // resolvedPaths 对应的 field 即使不属于任何 group 也不会被排斥在 groupMembers 外面。
        const dependFieldPaths = withSpecified ? paths : []

        for(const [field, path] of scopeItems(this.fields)) {
            if(fields.has(field)) continue
            for(const target of field.config.depends) {
                if(typeof target === 'string') {
                    if(nodeNames.has(target)) {
                        dependFieldPaths.push(path)
                        break
                    }
                } else {
                    const targetField = get(this.fields, target)
                    if(fields.has(targetField)) {
                        dependFieldPaths.push(path)
                        break
                    }
                }
            }
        }

        return dependFieldPaths
    }

    extractValues(propsValue=false) {
        const values = {}
        for(const [fieldState, path] of scopeItems(this.state.fields)) {
            setWithObj(values, path, propsValue ? fieldState.propsValue : fieldState.latestValidValue)
        }
        return values
    }

    // ========== UI Event handler ==========

    formOnSubmit = (event) => {
        event.preventDefault()
        this.submit()
    }

    widgetOnFocus = (path) => {
        this.setState('widgetFocus', immuSet(this.state, ['fields', ...path, 'hasFocus'], true))
    }

    widgetOnChange = (path, value) => {
        batchedUpdates(() => {
            // 检查 value 是不是 react 的 SyntheticEvent 对象。
            // 因为开发时，hgzxjs 和使用 hgzxjs 的 module 会分别引入一份 react 实例，
            // 所以没法用 hgzxjs 引入的 SyntheticEvent 和 module 中用另一个 react 实例生成的 SyntheticEvent 进行比较，
            // 只能改为根据此对象的特征来识别（https://facebook.github.io/react/docs/events.html#syntheticevent）
            if(typeof value === 'object' && value !== null && 'nativeEvent' in value) {
                value = this._getValueFromEvent(value)
            }
            this.setValue(path, value)

            // 若 value 是经由浏览器的自动填充功能填充进来的，则会在 hasFocus = false 的情况下触发此回调，
            // 此时，上面的 setValue() 调用已经会触发 validate，无需再 validate 一次了。
            if(get(this.state.fields, path).hasFocus) {
                const field = get(this.fields, path)
                if(field.config.validateDelay === 0) {
                    this.validate(path)
                } else if(field.config.validateDelay > 0) {
                    this.clearValidateTimeout(path)

                    field.validateTimeoutId = this.timerHost.setTimeout(() => {
                        // 在 setTimeout 中执行的方法已经跳出了上面的 batchedUpdates 的 context，因此要重新开启
                        batchedUpdates(() => {
                            field.validateTimeoutId = null
                            this.validate(path)
                        })
                    }, field.config.validateDelay)
                }
            }

            if(this.config.onChange) {
                const latestPropsValues = this.extractValues(true)
                if(!isEqual(this.form.latestPropsValues, latestPropsValues)) {
                    this.form.latestPropsValues = latestPropsValues
                    this.config.onChange()
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

    widgetOnKeyPress = (path, event) => {
        // 用户在文本框里按下回车时，也触发一次验证
        //
        // 虽然不知道为什么，如果一个字段之前不合法导致表单无法提交，现在改成合法值，但尚未经过验证，要验证后才能使“提交”按钮解除 disabled 状态，并允许表单提交。
        // 在这样的情况下，在这个字段里按下回车，居然能既触发验证，又在验证通过后能够触发提交。
        // 可能是这个 onKeyPress 事件的 handler 运行完成前，已经使得表单变得合法，然后立刻导致重新渲染、提交按钮解除禁用状态，
        // 然后浏览器才继续处理事件，把事件传递给了 form？
        if(event.charCode === 13) {
            batchedUpdates(() => this.validate(path))
        }
    }

    widgetOnBlur = path => {
        batchedUpdates(() => {
            this.blurred(path)

            /*
            在字段失去焦点时触发验证。
            但有一个例外：若此字段从未有过值，那么 blur 时不会触发验证。以减少不必要的验证行为对用户的打扰。
            例如经常有这样的情况：
            - 一个包含表单的弹出对话框，第一个字段设置了 autoFocus，所以对话框一打开它就拥有焦点了。
            - 此时用户看了看，觉得不需要或还没准备好填写这个对话框，他就想点“取消”按钮关闭它。
            - 但在“取消”按钮被点击到之前，那个获得了 focus 的字段的 blue 事件会先被触发，
              因为它没有值，属于不合法，于是使得页面重新渲染，以显示它的错误信息。
            - 这样一来，我们对“取消”按钮的点击行为就会无效化（可能是因为页面重新渲染使得我们并没能真的按到它），必须得再点一下才能真正关闭对话框。
            */
            const fieldState = get(this.state.fields, path)
            if(fieldState.status === TO_BE_VALID && fieldState.everHadValue) {
                this.validate(path)
            }
        })
    }


    // ========== helpers ==========

    // 将一个 value 转换成 react 能够正常处理的格式
    toProps(value) { return value === null ? '' : value }
}

function makeScope() { return { [scopeSymbol]: true } }
