import { invariant } from 'es-toolkit'
import type { Entry, Key, NodeType, ReadonlyState } from '../types'
import { Transaction } from './transaction'
import { getSingletonYDoc } from './ydoc'

export class EditorState implements ReadonlyState {
  private lastKey = -1
  private readonly ydoc
  private readonly state
  private readonly entries

  constructor(ydoc = getSingletonYDoc()) {
    this.ydoc = ydoc
    this.state = this.ydoc.getMap('state')
    this.entries = this.ydoc.getMap<Entry>('entries')
  }

  get<T extends NodeType>(key: Key<T>): Entry<T> {
    const entry = this.entries.get(key) as Entry<T> | undefined

    invariant(entry != null, `Node with key ${key} does not exist`)

    return entry
  }

  getEntries(): [string, Entry][] {
    return Array.from(this.entries.entries())
  }

  has(key: Key): boolean {
    return this.entries.has(key)
  }

  addUpdateListener(listener: () => void) {
    this.ydoc.on('update', listener)
  }

  removeUpdateListener(listener: () => void) {
    this.ydoc.off('update', listener)
  }

  update(updateFn: (t: Transaction) => void) {
    this.ydoc.transact(() => {
      updateFn(
        new Transaction(
          (key) => this.has(key),
          (key) => this.get(key),
          (key, entry) => this.set(key, entry),
          (type) => this.generateKey(type),
        ),
      )
      this.incrementUpdateCount()
    })
  }

  get updateCount(): number {
    const updateCount = this.state.get('updateCount') ?? 0

    invariant(typeof updateCount === 'number', 'updateCounter must be a number')

    return updateCount
  }

  private incrementUpdateCount() {
    this.state.set('updateCount', this.updateCount + 1)
  }

  private set<T extends NodeType>(key: Key<T>, entry: Entry<T>) {
    // TODO: How can I avoid the cast here?
    this.entries.set(key, entry as Entry)
  }

  private generateKey<T extends NodeType>(type: T): Key<T> {
    this.lastKey += 1

    return `${type}:${this.lastKey}`
  }
}
