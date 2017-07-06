
/*
开发环境下，若使用者是通过 yarn link 引入此类库，那么此类库里的 React 对象很可能和使用者 app 里的 React 对象不是同一个。
且在部分环境（Android，老版本 iOS 环境也有可能）下，使用者 app 里的 React 对象可能会在不支持 Symbol 的环境下被初始化。
（即使 app 引入了 babel-polyfill 也没用，react-native 会在 app script 运行之前先载入 react）

而 hgjs 里的 React 对象一定是在支持 Symbol 的环境下初始化的。（hgjs 要求必须先载入 babel-polyfill 才能使用它）

在不同的环境下初始化，会影响到 React 标记和识别 React element 的方式（详见 React.isValidElement() 的实现）。
因此，如果 hgjs 和 app 用到的 React 对象的初始化环境不一样，就会导致它们对对方创建出来的 component 互相都不认。

解决办法是手动调整 hgjs 里的 React 对象的初始化环境。
使用者把 app 里的 React 对象传进来，然后我们检查 app 的 React 对象是在哪种环境下初始化的，
并保证 hgjs 里的 React 对象也在同样的环境下初始化。
*/
export function fixReactElementSymbol(UserReact) {
    const testReactElement = { $$typeof: Symbol['for']('react.element') }
    if(UserReact.isValidElement(testReactElement)) return

    const _Symbol = Symbol
    global.Symbol = undefined

    require('react')

    global.Symbol = _Symbol
}
