import { isNonRootKey, type NonRootKey } from '../../store/types'
import { defineNonRootNode } from './define-non-root-node'
import { type NoIndex, NoIndexTrait } from './node-path'
import type { NonRootNodeType } from './types'

export function defineWrappedNode<T extends string, CJ, CI>(
  typeName: T,
  childType: NonRootNodeType<CJ, CI>,
) {
  return defineNonRootNode<{ type: T; value: CJ }, NoIndex, NonRootKey>()
    .extendType<{ HtmlTag: React.ElementType }>()
    .extend({
      isValidFlatValue: isNonRootKey,

      HtmlTag: 'div',

      toJsonValue(store, key) {
        const childKey = this.getFlatValue(store, key)
        const childValue = childType.toJsonValue(store, childKey)

        return { type: typeName, value: childValue }
      },

      store(tx, json, parentKey) {
        return tx.insert(typeName, parentKey, (key) =>
          childType.store(tx, json.value, key),
        )
      },

      render(store, key) {
        const HtmlTag = this.HtmlTag
        const childKey = this.getFlatValue(store, key)

        return (
          <HtmlTag key={key} id={key} data-key={key}>
            {childType.render(store, childKey)}
          </HtmlTag>
        )
      },
    })
    .extend(NoIndexTrait)
}
