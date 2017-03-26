import { Validator } from './Validator'

export class TextValidator extends Validator {
    get ruleOrder() {
        return ['type', 'regex']
    }

    rule_type(value, valid, invalid) {
        return typeof value !== 'string'
            ? invalid('应该是文本值')
            : valid()
    }

    rule_choices(value, valid, invalid) {
        return 'choices' in this.specs && this.specs.choices.indexOf(value) === -1
            ? invalid(`只能是 ${this.specs.choices.join('、')} 之一`)
            : valid()
    }

    /*
        与后端不同，前端的 regex rule 额外支持提供错误信息。好让用户能知道实际的格式要求是怎样的。
        只要把 regex 或 not_regex spec 设置成 [reg, msg] 即可。
    */
    rule_regex(value, valid, invalid) {
        if('regex' in this.specs) {
            const [regex, msg] = Array.isArray(this.specs.regex)
                ? this.specs.regex
                : [this.specs.regex, '不符合格式']
            if(!regex.test(value)) return invalid(msg)
        }

        if('not_regex' in this.specs) {
            const [not_regex, msg] = Array.isArray(this.specs.not_regex)
                ? this.specs.not_regex
                : [this.specs.not_regex, '不符合格式']
            if(not_regex.test(value)) return invalid(msg)
        }

        return valid()
    }

    /*
    使用提示：没有必要把 min_len 设为 1，它不会起任何作用。
    如果一个字段不允许为空字符串，把 emptyable 设为 false 即可。
    因为空字符串总是会被 emptyable 拦截住，在经它检查过后，无论是否通过，都不会再调用后续的 rule，
    也就是说压根不会有 min_len 小于 1 的字段值被传给这个 rule。
    */
    rule_len(value, valid, invalid) {
        const len = value.length;
        const [min, max] = [
            'min_len' in this.specs ? this.specs.min_len : null,
            'max_len' in this.specs ? this.specs.max_len : null]

        if((min !== null && len < min) || (max !== null && len > max)) {
            let msg;
            if(min !== null && max !== null) {
                msg = min !== max ? `应在${min} ~ ${max}个字之间` : `长度应为${min}个字`
            } else if(min !== null) {
                msg = `不能少于${min}个字`
            } else {
                msg = `不能超过${max}个字`
            }
            return invalid(msg)
        }
        return valid()
    }
}

/* NumberValidator 和 MoneyValidator 的基类 */
class _NumberValidator extends Validator {
    get ruleOrder() {
        return ['type']
    }

    get specDefaults() {
        return Object.assign({}, super.specDefaults, {
            nozero: false
        })
    }

    rule_type(value, valid, invalid) { throw new Error('未实现'); }

    rule_range(value, valid, invalid) {
        const [min, max] = [
            'min' in this.specs ? this.specs.min : null,
            'max' in this.specs ? this.specs.max : null]

        if((min !== null && this.lt(value, min)) || (max !== null && this.lt(max, value))) {
            let msg;
            if(min !== null && max !== null) {
                msg = this.messageTmpl(min, max).between
            } else if(min !== null) {
                msg = this.messageTmpl(min, max).min
            } else {
                msg = this.messageTmpl(min, max).max
            }
            return invalid(msg)
        }
        return valid()
    }

    rule_nozero(value, valid, invalid) {
        return this.specs.nozero && this.iszero(value)
            ? invalid('不能为 0')
            : valid()
    }

    messageTmpl(min, max) {
        return {
            between: `应在${min} ~ ${max}之间`,
            min: `不能小于${min}`,
            max: `不能大于${max}`
        }
    }

    // 判断 a 是否小于 b
    lt(a, b) { throw new Error('未实现'); }
    // 判断 n 是否为 0
    iszero(n) { throw new Error('未实现'); }
}

export class NumberValidator extends _NumberValidator {
    rule_type(value, valid, invalid) {
        value = parseInt(value)
        return isFinite(value) ? valid(value) : invalid('必须是合法的整数')
    }

    lt(a, b) { return a < b }
    iszero(n) { return n === 0 }
}

/*
将用户输入的以“元”为单位的数据转换成以“厘”为单位的金额数据。
详见 [处理浮点数](https://github.com/anjianshi/hgjs/blob/master/doc/%E5%A4%84%E7%90%86%E6%B5%AE%E7%82%B9%E6%95%B0.adoc)
*/
export class MoneyValidator extends _NumberValidator {
    rule_type(value, valid, invalid) {
        if(typeof value === 'number') {
            return valid()
        }

        value = parseFloat(value)
        return isFinite(value)
            ? valid(Math.round(value * 1000))   // 如果用户输入了超出“厘”部分的数值，将会被四舍五入
            : invalid('必须是合法的数值，可以是小数')
    }

    messageTmpl(min, max) {
        return {
            between: `应在${min.toPlainMoney()} ~ ${max.toPlainMoney()}之间`,
            min: `不能小于${min.toPlainMoney()}`,
            max: `不能大于${max.toPlainMoney()}`
        }
    }

    lt(a, b) { return a < b }
    iszero(n) { return n === 0 }
}

// 注意，对于 bool 类型的字段，任意长度大于 0 的字符串值，例如 'false', 'no', ' ' 都会被视为 true
export class BoolValidator extends Validator {
    ruel_type(value, valid) {
        return valid(!!value)
    }
}
