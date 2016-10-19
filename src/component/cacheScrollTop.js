const baseStateKey = '_cachedScrollTop'

/*
缓存 component 中指定元素的滚动条位置，并在下次 mount 时进行还原。

此 component 必须和 reduxState HoC 搭配使用，且 cache 必须设为 true。此 HoC 应放到 reduxState 的前面（下面）
如果有多个元素都需要控制滚动条，可以使用多次，但要为每个元素指定不重复的 extraKey。

getTargetRef(componentInstance): elementRefToScroll || falsy
    传入当前的 comopnent 实例，返回要对滚动条进行控制的元素
*/
export function cacheScrollTop(getTargetRef, extraKey=null) {
    const stateKey = baseStateKey + (extraKey ? '_' + extraKey : '')

    return function decorator(Component) {
        class ScrollTopCached extends Component {
            static displayName = Component.displayName || Component.name

            componentDidLoadState() {
                if(this.state[stateKey]) {
                    const ref = getTargetRef(this)
                    if(ref) ref.scrollTop = this.state[stateKey]
                    this['action__clearCachedScrollTop_' + extraKey]()
                }
                if(super.componentDidLoadState) super.componentDidLoadState()
            }

            componentWillClearState() {
                if(super.componentWillClearState) super.componentWillClearState()

                const ref = getTargetRef(this)
                if(ref) this['action__cacheScrollTop_' + extraKey](ref.scrollTop)
                ref.scrollTop = 0
            }

            ['action__cacheScrollTop_' + extraKey](scrollTop) {
                this.setState({ [stateKey]: scrollTop })
            }

            ['action__clearCachedScrollTop_' + extraKey]() {
                this.setState({ [stateKey]: null })
            }
        }
        return ScrollTopCached
    }
}
