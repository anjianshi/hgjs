const defaultOptions = {
    key: undefined,
    initialState: {},
    cache: false,

    connector: () => ({}),
}

export function parseOptions(getOptions, props) {
    const options = getOptions(props)
    if(!options.key.indexOf('/') === -1) throw new Error('reduxState: key 中不能包含 "/" 字符')
    if('initialState' in options && options.initialState === undefined) throw new Error('reduxState: initialState 不允许明确指定为 undefined')

    Object.keys(options).forEach(key => {
        if(!(key in defaultOptions)) throw new Error('错误的 options key: ' + key)
    })

    return {...defaultOptions, ...options}
}
