/*
对原始的金额数值进行格式化，添加"￥"符号，并强制补足两位小数
value: 以“厘”为单位的数值

相关说明见 [处理浮点数](https://github.com/anjianshi/hgjs/blob/master/doc/处理浮点数.adoc)
*/
export function money(value) {
    return '￥' + plainMoney(value)
}

/*
若 forceSuffix 为 true，则即使金额是一个整数，也会补充上 .00 后缀。（99 => 99.00）
若为 false，则在金额是整数时不会显示小数部分。（99 => 99）
*/
export function plainMoney(value, forceSuffix=true) {
    const money = value / 1000
    return !forceSuffix && Number.isInteger(money) ? money.toString() : toFixed(money, 2)
}

// 出于便捷性考虑，把 money() 函数放到 Number 的 prototype 中，这样就不用为了使用它而特意引入 functions 文件了
/* eslint-disable no-extend-native */
Number.prototype.toMoney = function() {
    return money(this)
}

Number.prototype.toPlainMoney = function(forceSuffix) {
    return plainMoney(this, forceSuffix)
}

/* eslint-disable */
/**
 * Decimal adjustment of a number.
 *
 * @param	{String}	type	The type of adjustment.
 * @param	{Number}	value	The number.
 * @param	{Integer}	exp		The exponent (the 10 logarithm of the adjustment base).
 * @returns	{Number}			The adjusted value.
 */
function decimalAdjust(type, value, exp) {
	// If the exp is undefined or zero...
	if (typeof exp === 'undefined' || +exp === 0) {
		return Math[type](value);
	}
	value = +value;
	exp = +exp;
	// If the value is not a number or the exp is not an integer...
	if (isNaN(value) || !(typeof exp === 'number' && exp % 1 === 0)) {
		return NaN;
	}
	// Shift
	value = value.toString().split('e');
	value = Math[type](+(value[0] + 'e' + (value[1] ? (+value[1] - exp) : -exp)));
	// Shift back
	value = value.toString().split('e');
	return +(value[0] + 'e' + (value[1] ? (+value[1] + exp) : exp));
}
/* eslint-enable */

/*
修正 Number.toFixed 的行为。
例如 (0.045).toFixed(2) 会返回 '0.04'，而不是 '0.05'

此解决办法来自 https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/round
是从这个问题中看到此办法的 http://stackoverflow.com/a/23204425/2815178
*/
function toFixed(value, precision) {
    return decimalAdjust('round', value, -precision).toFixed(precision)
}
