import { invariant } from 'es-toolkit'
import * as Y from 'yjs'
import type {
  JSONValue,
  Key,
  NodeType,
  ParentKey,
  WritableState,
} from '../types'

export function insertRoot(
  state: WritableState,
  key: Key<'root'>,
  value: JSONValue<'root'>,
): Key<'root'> {
  invariant(!state.has(key), `Root with key "${key}" is already stored`)

  state.insertRoot(key, insert(state, 'text', key, value.document))

  return key
}

export function insert<T extends Exclude<NodeType, 'root'>>(
  state: WritableState,
  type: T,
  parentKey: ParentKey<T>,
  value: JSONValue<T>,
): Key<T> {
  const text = new Y.Text()
  text.insert(0, value)

  return state.insert(type, parentKey, () => text)
}
