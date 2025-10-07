import type { Guard } from '../../guards'
import type { Key, Transaction } from '../../store/types'
import type { PrimitiveValue } from '../../utils/types'
import { defineNonRootNode } from './define-non-root-node'

export function definePrimitiveNode<V extends PrimitiveValue>(guard: Guard<V>) {
  return defineNonRootNode<V, V>()
    .extendType<{ updateValue(tx: Transaction, key: Key, newValue: V): void }>()
    .extend({
      isValidFlatValue: guard,

      toJsonValue(store, key) {
        return this.getFlatValue(store, key)
      },

      updateValue(tx, key, newValue) {
        tx.update(this.isValidFlatValue, key, newValue)
      },

      store(tx, json, parentKey) {
        return tx.insert(this.typeName, parentKey, () => json)
      },
    })
}
