import { isPlainObject } from 'lodash'
import { subtract } from 'lang'
import { Validator, TextValidator } from './validator'


export const VALID = 'valid'
export const INVALID = 'invalid'
export const TO_BE_CONFIRM = 'toBeConfirm'

export const VALIDATING = 'validating'
export const TO_BE_VALID = 'toBeValid'

// ================================

export const formState = () => ({
    fields: {},     // scope struct
    status: VALID,
    submitting: false
})

export function fieldState(config, initValue) {
    const hasInit = initValue !== undefined
    const hasDefault = config.default !== undefined
    const value = hasInit ? initValue : (hasDefault ? config.default : undefined)
    return {
        latestValidValue: value,
        propsValue: (value === null || value === undefined) ? '' : value,

        status: (hasInit || hasDefault) ? VALID : TO_BE_VALID,
        message: null,
        everHadValue: value !== undefined,
        hasFocus: false,
    }
}

/*
fields
    格式： { name: fieldConfig, ... } （scope struct）
    fields 可以动态增减。form 会根据最新的 fields 列表来新增和移除 field callback / state。
    但不支持动态修改 field 定义。在 form 内部，field 的定义会一直维持在第一次读取时的状态，直到它被移除。

    fields=null 或其他 falsy 值是允许的，和 fields={} 是同样的效果

    fieldConfig 的格式见 formatFieldConfig()

initValues
    新增 field 时，会尝试从这里提取初始值。
    结构和 fields 一样，但不用设置 scopeSymbol。

onChange
    此回调只在因用户的交互导致值变更时触发，以编程的形式调用 setValue() 不会触发此回调。
onSubmit
submitWhenValid

以上内容的详细介绍见 form 技术文档（index.js 里有它的链接）
*/
export function formConfig(raw) {
    return {
        fields: raw.fields || {},
        initValues: raw.initValues || null,
        onChange: raw.onChange || null,
        onSubmit: raw.onSubmit || null,
        submitWhenValid: raw.submitWhenValid || false,
    }
}

/*
field config 可以有三种形式：

1. object
此为标准的 config 格式，通过各 key 对 field 进行具体设置

2. validator
把一个 validator 作为 field config，这样其他部分的配置项都会使用默认值

3. any value
也可以用任意其他值，如 true、null 作为 field config，此时所有配置项都使用默认值

field config 里可以使用的配置项及默认值见下面代码
*/
export function fieldConfig(raw) {
    const config = {
        default: undefined,                 // undefined 代表没有默认值
        validator: new TextValidator(),
        bizRule: null,
        validateDelay: 'intime',
        restoreValid: false,
        depends: [],
    }

    if(raw instanceof Validator) {
        config.validator = raw
    } else if(isPlainObject(raw)) {
        if(process.env.NODE_ENV === 'development') {
            const unexpectedKeys = subtract(Object.keys(raw), Object.keys(config))
            if(unexpectedKeys.length) throw new Error('form field config 中出现了不应出现的 key: ' + unexpectedKeys.join(', '))
        }
        Object.assign(config, raw)

        if(typeof config.validateDelay === 'string') {
            if(!(config.validateDelay in validateDelayKeywords)) throw new Error(`form validateDelay keyword ${config.validateDelay} 不存在`)
            config.validateDelay = validateDelayKeywords[config.validateDelay]
        }
    }

    return config
}

const validateDelayKeywords = {
    'lazy': -1,
    'realtime': 0,      // 实时
    'intime': 200,      // 及时
    'peace': 700,      // 平静的，不会过度频繁的
}
