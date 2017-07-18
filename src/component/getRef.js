import hoistNonReactStatic from 'hoist-non-react-statics'

// 应用了 HOC 的 component，使用者无法直接获得它的 ref
// 通过使用此 decorator，可以实现让使用者改为通过 getRef props 获得 ref
// <SomeCom getRef={r => this.xxx = r} />
export function getRef(Component) {
    class WithGetRef extends Component {
        static displayName = Component.displayName || Component.name

        constructor(props) {
            super(props)

            if(props.getRef) props.getRef(this)
        }
    }

    return hoistNonReactStatic(WithGetRef, Component)
}
