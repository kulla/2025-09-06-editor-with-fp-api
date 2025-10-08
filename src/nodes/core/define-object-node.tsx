import { invariant } from 'es-toolkit'
import {
  isArrayOf,
  isIntersectionOf,
  isKeyOf,
  isString,
  isTupleOf,
} from '../../guards'
import type { EditorStore } from '../../store/store'
import { isNonRootKey, type Key, type NonRootKey } from '../../store/types'
import { defineNonRootNode } from './define-non-root-node'
import type { JSONValue, NonRootNodeType } from './types'

export function defineObjectNode<C extends Record<string, NonRootNodeType>>(
  childTypes: C,
  keyOrder: (keyof C)[],
) {
  return defineNonRootNode<
    { [K in keyof C]: JSONValue<C[K]> },
    number,
    [keyof C & string, NonRootKey][]
  >()
    .extendType<{
      HtmlTag: React.ElementType
      getPropKey(store: EditorStore, key: Key, prop: keyof C): NonRootKey
    }>()
    .extend({
      isValidFlatValue: isArrayOf(
        isTupleOf(
          isIntersectionOf(isString, isKeyOf(childTypes)),
          isNonRootKey,
        ),
      ),

      HtmlTag: 'div',

      getPropKey(store, key, prop) {
        const entries = this.getFlatValue(store, key)
        const entry = entries.find(([p]) => p === prop)

        invariant(entry, `Property ${String(prop)} not found in object ${key}`)

        return entry[1]
      },

      toJsonValue(store, key) {
        const props = this.getFlatValue(store, key).map(([prop, childKey]) => {
          const childType = childTypes[prop]

          return [prop, childType.toJsonValue(store, childKey)]
        })

        return Object.fromEntries(props) as {
          [K in keyof C]: JSONValue<C[K]>
        }
      },

      store(tx, json, parentKey) {
        return tx.insert(this.typeName, parentKey, (key) => {
          return keyOrder.map((prop) => {
            const childType = childTypes[prop]
            const childKey = childType.store(tx, json[prop], key)

            return [prop, childKey] as [keyof C & string, NonRootKey]
          })
        })
      },

      render(store, key) {
        const HtmlTag = this.HtmlTag
        const children = this.getFlatValue(store, key).map(
          ([prop, childKey]) => {
            const childType = childTypes[prop]

            return childType.render(store, childKey)
          },
        )

        return (
          <HtmlTag key={key} id={key} data-key={key} className={this.typeName}>
            {children}
          </HtmlTag>
        )
      },

      getIndexWithin(store, key, childKey) {
        const entries = this.getFlatValue(store, key)
        const index = entries.findIndex(([, k]) => k === childKey)

        invariant(
          index !== -1,
          `Child key ${childKey} not found in object ${key}`,
        )

        return index
      },
    })
}
