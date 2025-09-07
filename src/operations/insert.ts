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
  if (type === 'content' && Array.isArray(value)) {
    return state.insert('content', parentKey as ParentKey<'content'>, (key) =>
      value.map((child) => insert(state, 'paragraph', key, child)),
    ) as Key<T>
  } else if (typeof value === 'string') {
    const text = new Y.Text()
    text.insert(0, value)

    return state.insert<'text'>('text', parentKey, () => text) as Key<T>
  } else {
    return state.insert(
      'paragraph',
      parentKey as ParentKey<'paragraph'>,
      (key) =>
        insert(state, 'text', key, (value as JSONValue<'paragraph'>).value),
    ) as Key<T>
  }
}
