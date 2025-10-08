import { invariant } from 'es-toolkit'
import type { FlatValue } from '../../store/types'
import { defineNode } from './define-node'
import type { Index } from './node-path'
import type { NonRootNodeType } from './types'

export function defineNonRootNode<J, I extends Index, F extends FlatValue>() {
  return defineNode<J, I, F>()
    .extendType<NonRootNodeType<J, I, F>>()
    .extend((Base) => ({
      getParentKey(store, key) {
        const parentKey = Base.getParentKey.call(this, store, key)

        invariant(parentKey != null, `Non-root node ${key} has no parent`)

        return parentKey
      },
    }))
}
