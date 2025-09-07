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

  state.insertRoot(
    key,
    insert({
      state,
      type: 'content',
      parentKey: key,
      jsonValue: value.document,
    }),
  )

  return key
}

export function insert<T extends Exclude<NodeType, 'root'>>({
  state,
  type,
  parentKey,
  jsonValue,
}: {
  state: WritableState
  type: T
  parentKey: ParentKey<T>
  jsonValue: JSONValue<T>
}): Key<T> {
  if (type === 'content' && Array.isArray(jsonValue)) {
    return state.insert('content', parentKey, (key) =>
      jsonValue.map((child) =>
        insert({ state, type: 'paragraph', parentKey: key, jsonValue: child }),
      ),
    ) as Key<T>
  } else if (typeof jsonValue === 'string') {
    const text = new Y.Text()
    text.insert(0, jsonValue)

    return state.insert('text', parentKey, () => text) as Key<T>
  } else {
    return state.insert(
      'paragraph',
      parentKey as ParentKey<'paragraph'>,
      (key) =>
        insert({
          state,
          type: 'text',
          parentKey: key,
          jsonValue: (jsonValue as JSONValue<'paragraph'>).value,
        }),
    ) as Key<T>
  }
}
