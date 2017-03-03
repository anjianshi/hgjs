/*
[表单类库技术细节](https://github.com/anjianshi/hgjs/blob/master/doc/form/表单类库技术细节.adoc)

------------------

Form 工具的运行模式：

通过 component 实现 props / updated props 的接收、与 component lifecycle 的绑定（在 component unmount 时自动清除 form...）、
并简化使用者取得 form data 及 form state 的过程

通过独立的 JavaScript 代码，实现 form 的实际业务行为（form instance 及 form state 的建立及维护）。

form instance 里保存了 form 运行过程中产生的中间数据；form state 是独立于 instance 的 form 当前完整有效的状态。
form 可以抛弃 form instance，完全依靠 form state 及 form config 重新建立起来并保持之前的状态（但是像正在进行的异步验证等信息将消失）


此工具需要搭配 reducerHost 使用，且要求 store 应用了 hgjs/store 下的 supportBatchedUpdates。

--------------------

此类库的多个地方都把 undefined 视为“no value”，因此，它实际上不支持把 undefined 作为字段值
*/
export { FormComponent as Form } from './component'
export { scopeSymbol } from './scopeStruct'
export { VALID, INVALID, TO_BE_CONFIRM, VALIDATING, TO_BE_VALID } from './standard'
export * from './validator'
