export class EventSource {
    constructor() {
        this.listeners = new Set()
    }

    addListener(listener) {
        this.listeners.add(listener)
    }

    removeListener(listener) {
        this.listeners.delete(listener)
    }

    emit(...args) {
        for(const listener of this.listeners) {
            listener(...args)
        }
    }

    clear() {
        this.listeners = new Set()
    }
}
