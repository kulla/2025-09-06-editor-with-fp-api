import { invariant } from 'es-toolkit'
import type { FlatValue } from '../store/types'
import { defineNode } from './define-node'
import type { NonRootNodeType } from './types'

export function defineNonRootNode<J, F extends FlatValue>() {
  return defineNode<J, F>()
    .extendType<NonRootNodeType<J, F>>()
    .extend((Base) => ({
      getParentKey(store, key) {
        const parentKey = Base.getParentKey.call(this, store, key)

        invariant(parentKey != null, `Non-root node ${key} has no parent`)

        return parentKey
      },
    }))
}
