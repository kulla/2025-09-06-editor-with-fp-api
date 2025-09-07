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

  state.insertRoot(key, insert(state, 'content', key, value.document))

  return key
}

export function insert<T extends Exclude<NodeType, 'root'>>(
  state: WritableState,
  type: T,
  parentKey: ParentKey<T>,
  value: JSONValue<T>,
): Key<T> {
  if (Array.isArray(value)) {
    return state.insert(type, parentKey, (key) =>
      value.map((child) => insert(state, 'paragraph', key, child)),
    )
  } else if (typeof value === 'string') {
    const text = new Y.Text()
    text.insert(0, value)

    return state.insert(type, parentKey, () => text)
  } else {
    return state.insert(type, parentKey, (key) =>
      insert(state, 'text', key, value.value),
    )
  }
}
