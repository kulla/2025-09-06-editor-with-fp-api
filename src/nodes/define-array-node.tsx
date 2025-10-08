import { invariant } from 'es-toolkit'
import { isArrayOf } from '../guards'
import { isNonRootKey, type NonRootKey } from '../store/types'
import { defineNonRootNode } from './define-non-root-node'
import type { NonRootNodeType } from './types'

export function defineArrayNode<CJ>(childType: NonRootNodeType<CJ>) {
  return defineNonRootNode<CJ[], NonRootKey[]>()
    .extendType<{ HtmlTag: React.ElementType }>()
    .extend({
      isValidFlatValue: isArrayOf(isNonRootKey),

      HtmlTag: 'div',

      toJsonValue(store, key) {
        const childKeys = this.getFlatValue(store, key)
        return childKeys.map((childKey) =>
          childType.toJsonValue(store, childKey),
        )
      },

      store(tx, json, parentKey) {
        return tx.insert(this.typeName, parentKey, (key) =>
          json.map((item) => childType.store(tx, item, key)),
        )
      },

      render(store, key) {
        const HtmlTag = this.HtmlTag
        const childKeys = this.getFlatValue(store, key)

        const children = childKeys.map((childKey) =>
          childType.render(store, childKey),
        )

        return (
          <HtmlTag key={key} id={key} data-key={key}>
            {children}
          </HtmlTag>
        )
      },

      getIndexWithin(store, key, childKey) {
        invariant(
          isNonRootKey(childKey),
          'Child key must be a non-root key in ArrayNode.getIndexWithin',
        )
        const childKeys = this.getFlatValue(store, key)
        return childKeys.indexOf(childKey)
      },
    })
}
