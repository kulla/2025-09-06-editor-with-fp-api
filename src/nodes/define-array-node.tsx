import { invariant } from 'es-toolkit'
import { isArrayOf } from '../guards'
import { isNonRootKey, type NonRootKey } from '../store/types'
import { defineNonRootNode } from './define-non-root-node'
import { pushIndex } from './node-path'
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

      render(store, key, cursor) {
        const HtmlTag = this.HtmlTag
        const childKeys = this.getFlatValue(store, key)

        const { selection: { start = null, end = null } = {}, nodePath } =
          cursor

        const children = childKeys.map((childKey, i) =>
          childType.render(store, childKey, pushIndex(cursor, i)),
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

      delete(
        { tx, key, store },
        [startIdx, ...startPath],
        [endIdx, ...endPath],
        deleteKind,
      ) {
        const childKeys = this.getFlatValue(store, key)

        let startIndex = startIdx ?? 0
        let endIndex = endIdx ?? childKeys.length

        if (typeof startIndex !== 'number' || typeof endIndex !== 'number') {
          return false
        }

        if (startIndex === endIndex) {
          if (deleteKind === 'backward') {
            startIndex = Math.max(0, startIndex - 1)
          } else if (deleteKind === 'forward') {
            endIndex = Math.min(childKeys.length, endIndex + 1)
          }
        }

        if (
          startIndex < 0 ||
          endIndex > childKeys.length ||
          startIndex >= endIndex
        ) {
          return false
        }

        tx.update(this.isValidFlatValue, key, (array) => {
          return array.filter((_, idx) => idx < startIndex || idx >= endIndex)
        })

        return true
      },
    })
}
