import type { PrimitiveValue } from '../../utils/types'
import { definePrimitiveNode } from './define-primitive-node'

export function defineLiteralNode<T extends PrimitiveValue>(value: T) {
  return definePrimitiveNode((v): v is T => v === value).extend({
    render() {
      return null
    },
  })
}
