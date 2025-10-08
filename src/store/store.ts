import { invariant } from 'es-toolkit'
import type { Map as YMap } from 'yjs'
import type { Cursor } from '../selection'
import type { FlatValue, Key, NonRootKey, Transaction } from './types'
import { getSingletonYDoc } from './ydoc'

export class EditorStore {
  protected readonly values: YMap<FlatValue>
  protected readonly parentKeys: YMap<Key | null>
  protected readonly state: YMap<unknown>
  protected readonly typeNames: YMap<string>
  private currentTransaction: Transaction | null = null

  constructor(private readonly ydoc = getSingletonYDoc()) {
    this.values = ydoc.getMap('values')
    this.parentKeys = ydoc.getMap('parentKeys')
    this.state = ydoc.getMap('state')
    this.typeNames = ydoc.getMap('typeNames')
  }

  getCursor() {
    // TODO: Add a guard to ensure the structure is correct
    return (this.state.get('cursor') ?? null) as Cursor | null
  }

  getValue<F extends FlatValue>(
    guard: (value: FlatValue) => value is F,
    key: Key,
  ): F {
    const value = this.values.get(key)

    invariant(value != null, `Value for key ${key} not found`)
    invariant(guard(value), `Value for key ${key} has unexpected type`)

    return value
  }

  getTypeName(key: Key): string {
    const typeName = this.typeNames.get(key)

    invariant(typeName != null, `Type name for key ${key} not found`)

    return typeName
  }

  getParentKey(key: Key): Key | null {
    return this.parentKeys.get(key) ?? null
  }

  has(key: Key): boolean {
    return this.values.has(key)
  }

  getValueEntries() {
    return Array.from(this.values.entries())
  }

  get updateCount() {
    const count = this.state.get('updateCount') ?? 0

    invariant(typeof count === 'number', 'updateCount must be a number')

    return count
  }

  addUpdateListener(listener: () => void) {
    this.ydoc.on('update', listener)
  }

  removeUpdateListener(listener: () => void) {
    this.ydoc.off('update', listener)
  }

  update<A>(updateFn: (tx: Transaction) => A): A {
    if (this.currentTransaction) {
      // If we're already in a transaction, just call the update function directly
      return updateFn(this.currentTransaction)
    } else {
      // TODO: Find a better way to handle this
      let result = null as unknown as A

      this.ydoc.transact(() => {
        this.currentTransaction = this.createNewTransaction()

        try {
          result = updateFn(this.currentTransaction)

          this.incrementUpdateCount()
        } finally {
          this.currentTransaction = null
        }
      })

      return result
    }
  }

  private createNewTransaction(): Transaction {
    return {
      update: (guard, key, updateFn) => {
        const currentValue = this.getValue(guard, key)
        const newValue =
          typeof updateFn === 'function' ? updateFn(currentValue) : updateFn

        this.values.set(key, newValue)
      },
      attachRoot: (rootKey, value) => {
        invariant(
          !this.has(rootKey),
          `Root key ${rootKey} already exists in the store`,
        )

        this.values.set(rootKey, value)
        this.parentKeys.set(rootKey, null)
        this.typeNames.set(rootKey, 'root')

        return rootKey
      },
      insert: (typeName, parentKey, createValue) => {
        const newKey = this.generateNextKey()
        const value = createValue(newKey)

        this.values.set(newKey, value)
        this.parentKeys.set(newKey, parentKey)
        this.typeNames.set(newKey, typeName)

        return newKey
      },
      setCursor: (cursor) => {
        this.state.set('cursor', cursor)
      },
      setCaret(point) {
        this.setCursor({ start: point, end: point })
      },
    }
  }

  private incrementUpdateCount() {
    this.state.set('updateCount', this.updateCount + 1)
  }

  private generateNextKey(): NonRootKey {
    const current = this.state.get('lastKeyNumber') ?? 0
    invariant(typeof current === 'number', 'lastKeyNumber must be a number')

    const next = current + 1
    this.state.set('lastKeyNumber', next)

    return String(next) as NonRootKey
  }
}
