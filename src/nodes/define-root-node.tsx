import type { EditorStore } from '../store/store'
import {
  isNonRootKey,
  type Key,
  type NonRootKey,
  type RootKey,
  type Transaction,
} from '../store/types'
import { defineNode } from './define-node'
import { NoIndexTrait } from './node-path'
import type { NonRootNodeType } from './types'

export function defineRootNode<CJ>(childType: NonRootNodeType<CJ>) {
  return defineNode<CJ, NonRootKey>()
    .extendType<{
      attachRoot(tx: Transaction, rootKey: RootKey, json: CJ): void
      render(
        store: EditorStore,
        key: Key,
        keyDown: React.KeyboardEventHandler,
      ): React.ReactNode
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

      render(store, key, onKeyDown) {
        const childKey = this.getFlatValue(store, key)
        return (
          <article
            key={key}
            id={key}
            data-key={key}
            contentEditable
            suppressContentEditableWarning
            spellCheck={false}
            // @ts-ignore-error React types are wrong
            onKeyDown={onKeyDown}
          >
            {childType.render(store, childKey)}
          </article>
        )
      },
    })
    .extend(NoIndexTrait)
}
