import {
  isNonRootKey,
  type NonRootKey,
  type RootKey,
  type Transaction,
} from '../../store/types'
import { defineNode } from './define-node'
import { type NoIndex, NoIndexTrait } from './node-path'
import type { NonRootNodeType } from './types'

export function defineRootNode<CJ>(childType: NonRootNodeType<CJ>) {
  return defineNode<CJ, NoIndex, NonRootKey>()
    .extendType<{
      attachRoot(tx: Transaction, rootKey: RootKey, json: CJ): void
    }>()
    .extend({
      isValidFlatValue: isNonRootKey,

      toJsonValue(store, key) {
        const childKey = store.getValue(this.isValidFlatValue, key)
        return childType.toJsonValue(store, childKey)
      },

      attachRoot(tx, rootKey, json) {
        tx.attachRoot(rootKey, childType.store(tx, json, rootKey))
      },

      render(store, key) {
        const childKey = this.getFlatValue(store, key)
        return (
          <article
            key={key}
            id={key}
            data-key={key}
            contentEditable
            suppressContentEditableWarning
            spellCheck={false}
          >
            {childType.render(store, childKey)}
          </article>
        )
      },
    })
    .extend(NoIndexTrait)
}
