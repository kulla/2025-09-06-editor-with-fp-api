import { invariant } from 'es-toolkit'
import { isNonRootKey, type NonRootKey } from '../../store/types'
import { defineNonRootNode } from './define-non-root-node'
import type { JSONValue, NonRootNodeType } from './types'

export function defineUnionNode<
  C extends [NonRootNodeType, NonRootNodeType, ...NonRootNodeType[]],
>(childTypes: C, getTypeName: (json: JSONValue<C[number]>) => string) {
  function getChildType(childTypeName: string) {
    const childType = childTypes.find((ct) => ct.typeName === childTypeName)

    invariant(childType, 'No matching child type found')

    return childType
  }

  return defineNonRootNode<JSONValue<C[number]>, NonRootKey>().extend({
    isValidFlatValue: isNonRootKey,

    toJsonValue(store, key) {
      const childKey = this.getFlatValue(store, key)
      const childType = getChildType(store.getTypeName(childKey))

      return childType.toJsonValue(store, childKey) as JSONValue<C[number]>
    },

    store(tx, json, parentKey) {
      const childType = getChildType(getTypeName(json))

      return tx.insert(this.typeName, parentKey, (key) =>
        childType.store(tx, json, key),
      )
    },

    render(store, key) {
      const childKey = this.getFlatValue(store, key)
      const childType = getChildType(store.getTypeName(childKey))

      return childType.render(store, childKey)
    },
  })
}
