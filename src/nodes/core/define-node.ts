import type { FlatValue } from '../../store/types'
import type { Index } from './node-path'
import { TypeBuilder } from './type-builder'
import type { NodeType } from './types'

export function defineNode<J, I extends Index, F extends FlatValue>() {
  return TypeBuilder.begin<NodeType<J, I, F>>().extend({
    getFlatValue(store, key) {
      return store.getValue(this.isValidFlatValue, key)
    },

    getParentKey(store, key) {
      return store.getParentKey(key)
    },

    onCommand: {},
  })
}
