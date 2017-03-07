/*
扩展 JavaScript 的 JSON 处理函数，实现对 Map 和 Set 的 JSON 化
*/


// 这两个类型默认的 toJSON 实现会影响我们的自定义实现
// 虽然规范上是说这些方法都是 readonly 的，但在 chrome、node 环境下测试进行覆盖，都没有发现问题
Map.prototype.toJSON = undefined        // eslint-disable-line no-extend-native
Set.prototype.toJSON = undefined        // eslint-disable-line no-extend-native


export function exToJSON(data) {
    return JSON.stringify(data, replacer)
}

function replacer(key, value) {
    if(value instanceof Map) return toJSONMapObj(value)
    else if(value instanceof Set) return toJSONSetObj(value)
    return value
}

export function exParseJSON(json) {
    return JSON.parse(json, reviver)
}

function reviver(key, value) {
    return isJSONMapObj(value)
        ? restoreJSONMapObj(value)
        : (isJSONSetObj(value) ? restoreJSONSetObj(value) : value)
}

// ==========================

const typeKey = '_exjson_type'

function toJSONMapObj(map) {
    return {
        [typeKey]: 'map',
        entries: Array.from(map)
    }
}

function isJSONMapObj(value) {
    return value && typeof value === 'object' && value[typeKey] === 'map'
}

function restoreJSONMapObj(obj) {
    return new Map(obj.entries)
}


function toJSONSetObj(set) {
    return {
        [typeKey]: 'set',
        items: Array.from(set)
    }
}

function isJSONSetObj(value) {
    return value && typeof value === 'object' && value[typeKey] === 'set'
}

function restoreJSONSetObj(obj) {
    return new Set(obj.items)
}
