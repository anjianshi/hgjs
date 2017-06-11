/*
定义一些 component 相关的工具函数、decorator、Hoc

关于 decorator 和 Hoc 的规范，见 README.adoc
*/

export * from './functions'
export { enhanceProps } from './enhanceProps'
export { enhanceState } from './enhanceState'
export { withTimer, withPromiseHost } from './hosts'
