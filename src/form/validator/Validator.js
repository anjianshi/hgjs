import { getAllMethodNames } from 'lang'
import { isPlainObject } from 'lodash'

/*
此类为 Python API-libs 里 Parameter 的 port (https://github.com/anjianshi/API-libs)
根据前端的实际情况和需求，对运行逻辑进行了调整，并补充了一些功能。
它既能配合 Form 模块用于表单验证，也可以独立用于其他任何需要格式验证的地方。

每个 validator 都由多条规则（rule）组成，通过设置 specs，可以对这些 rule 进行定制。
这些规则依次执行，当任意一条规则判定字段值不合法时，就会结束验证，后面的规则将不再被调用。如果所有规则都检查通过，则判定字段值合法。
每一条规则都可以对字段值进行格式化，它格式化后的结果将会交给下一个规则，并最终输出成为验证结果。

1.  不记录 name。

2.  移除了 required 规则。对于前端表单来说，字段值就只有空和非空这两种状态。
    并不存在一个持久的未赋值的状态。
   （例如对于 input，即使没有指定值，它的值也会被填充为空字符串）。
    所以用一个 nullable 来检查（实际为 emptyable，见后面的介绍）就够了，不需要 required 规则。

3.  所有类型的 validator 现在都允许接收字符串值。
    因为表单字段的 value 总是字符串类型的。
    所以各种 validator 都要有把字符串值转换成自己所需的类型的能力。

    那可不可以把这一行为放到 input 自己的事件回调中，让 validator 仍然只负责自己对应的类型的值呢？
    这样是不合理的。
    因为在转换值类型的过程中，可能会因为值的格式不合法，无法完成转换。
    这种情况属于“值不符合格式”，因此应该交给 validator 来处理。
    这样才能很方便的向用户报错、提供错误信息。

    为此，作为字符串预处理规则的 tirm 规则现在也变成了对所有 validator 都可用。
    因为清理空格可以对类型转换提供帮助。

4.  把空字符串也视为空值。
    因此，nullable 规则改名为 emptyable。并且会把空字符串自动转换成 null，以统一值的类型。

    默认情况下，只有空格的字符串也可以被视为是空字符串。
    因此，把 tirm 规则的执行顺序移动到 emptyable 前面，让它把这类字符串先转换为空字符串，再交给 emptyable 处理。

5.  用 undefined 来模拟“未赋值”状态。
    此状态下，会尝试填充默认值，若未指定默认值，填充 null
    （这一点和后端不一样，在后端，若未指定默认值，会让字段维持在未赋值状态；
    而对于前端字段来说，维持在未赋值状态没什么意义，又会影响到 emptyable 规则的行为，所以没有这么做）

    前端表单不像后端，能明确的区分什么时候未赋值，什么时候赋了空值
    （未赋值时，字段 key 根本就不出现；赋空值时，key 是出现的，只不过值为 null）
    因此设计成值为 undefined 时，视为未赋值；值为 null（或空字符串）时，视为赋了空值。

    之所以选择了 undefined，是因为对于前端表单来说，undefined 这个值在正常的情况下是不应该存在的。
    应该没有什么情况，会使一个字段产生 undefined 值。例如对于 input 来说，它在没有值时，实际的值是空字符串。
    即使经过了某些处理 / 格式转换，那也应该变成 null，而不是 undefined。
    所以，就把代表未赋值状态的任务交给了 undefined。当希望告诉 validator，某个字段没有值，要填充默认值时，就把 undefined 交给它。
    这也符合 undefined 原本的定义。

    不过要注意，在这种情况下，万一在某个地方意外地把字段原本的值转换成了 undefined（原本应转换成 null 或其他什么值的），
    就会导致字段被填充默认值。所以一定要注意检查，程序中有没有哪个会生成 undefined 值的地方。
    并且因此，undefined 也不会再被视为空值（实际上 undefined 值在默认情况下根本就没机会被传到 emptyable 规则那儿）。

6.  增加了根据失败原因生成错误信息的功能，在验证的同时返回对应的错误信息。

=====================================

# Rule 规范
各 rule 函数在被调用时，都会获得如下参数：
- value                     待验证的值
- valid(formattedValue)     若字段值通过了验证，应调用此函数，并返回它的返回值。如果要对字段值进行格式化，在调用时，应把格式化后的值传给它。
- invalid(messge)           若字段值未通过验证，应调用此函数，把错误信息传给它，然后返回它的返回值

*/
export class Validator {
    constructor(specs) {
        this.specs = { ...this.specDefaults, ...specs }
        this.systemRules = this.systemRuleOrder.map(name => 'system_' + name)
        this.normalRules = this._sortedNormalRules().map(name => 'rule_' + name)
    }

    _sortedNormalRules() {
        if(!this.ruleOrder.length === (new Set(this.ruleOrder)).size) {
            throw new Error(`ruleOrder 中不允许出现重复的内容(${this.ruleOrder})`)
        }

        const notSortedRules =
            getAllMethodNames(this, name => /^rule_/.test(name))
                .map(name => name.substr(5))
                .filter(name => this.ruleOrder.indexOf(name) === -1)

        return [...this.ruleOrder, ...notSortedRules]
    }

    /**
     * inplaceSpecs: {key: value, ...}
     * removeSpecs: [key1, key2, ...]
     */
    copy(inplaceSpecs=null, removeSpecs=null) {
        const specs = {...this.specs, ...inplaceSpecs}
        if(removeSpecs) {
            for(const key of removeSpecs) delete specs[key]
        }
        return new this.constructor(specs)
    }

    /*
    检查 value 是否符合当前 validator 中指定的要求。

    # validate result 的格式
    valid:  {valid: true, value: formattedValue}
    invalid: {valid: false, message: content}

    # method sign
    validate(value): result
    */
    validate(value) {
        let result = {valid: true, value: value}

        const iterRules = (rules) => {
            for(const rule of rules) {
                result = this.callRule(rule, result.value)
                if(!result.valid) break
            }
        }

        iterRules(this.systemRules)

        // 值为 empty 的情况下，不会调用 normal rules 直接返回。
        // 因为 emptyable rule 会把所有 empty 值都统一转换成 null，所以这里只要检查 null 就行了
        if(result.valid && result.value !== null) {
            iterRules(this.normalRules)
        }

        return result
    }

    // ===== internal methods =====

    callRule(ruleName, value) {
        // 这个函数必须用 function 语法，不能用 arrow 语法，不然无法正确统计 argument length
        function valid(formattedValue) {
            return {
                valid: true,
                value: (arguments.length === 0 ? value : formattedValue),
            }
        }
        const invalid = (message) => ({valid: false, message})

        const result = this[ruleName](value, valid, invalid)
        if(!isPlainObject(result)) throw new Error('field rule 返回值格式错误')
        return result
    }

    // ===== rules =====

    // 各 system rule 的执行顺序，不出现在这里的 system rule 不会被执行。
    // 若要修改，请确保自己了解各 system rule 的行为及其意义。
    get systemRuleOrder() {
        return ['default', 'trim', 'emptyable']
    }

    // 各普通 rule 的执行顺序，未出现在这里的 rule 会在这些 rule 之后以随机顺序被执行。
    get ruleOrder() {
        return []
    }

    // 返回各 spec 的默认值。
    // 子类覆盖此方法时，应继承父类中设置的默认值。
    // 方法为： return Object.assign({}, super.specDefaults, {specInChild: value});
    get specDefaults() {
        return {
            trim: true,
            emptyable: false
        }
    }

    // 若此 field 处于未赋值状态，则填充默认值或 null
    system_default(value, valid) {
        return valid(
            value === undefined
                ? 'default' in this.specs ? this.specs.default : null
                : value
        )
    }

    system_trim(value, valid) {
        return valid(
            this.specs.trim && typeof value === 'string'
                ? value.trim()
                : value
        )
    }

    /* 是否允许值为 null 或 空字符串 */
    system_emptyable(value, valid, invalid) {
        if(value === null || value === '') {
            if(!this.specs.emptyable) {
                return invalid('不能为空')
            }
            return valid(null)
        }
        return valid()
    }
}
