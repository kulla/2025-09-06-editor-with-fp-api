import type { FlatValue } from '../store/types'
import { TypeBuilder } from './type-builder'
import type { NodeType } from './types'

export function defineNode<J, F extends FlatValue>() {
  return TypeBuilder.begin<NodeType<J, F>>().extend({
    getFlatValue(store, key) {
      return store.getValue(this.isValidFlatValue, key)
    },

    getParentKey(store, key) {
      return store.getParentKey(key)
    },

    onCommand: {},
  })
}
