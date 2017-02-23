import { makeReducerHost } from './store'

// 使用任何依赖此 host 的工具前，需先初始化此 host（放到 redux store 里或 link 到另一个 host）
export const libReducerHost = makeReducerHost()
