import { invariant } from 'es-toolkit'
import * as Y from 'yjs'
import type { JSONValue, Key, NodeType, WritableState } from '../types'

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

export function insert<T extends Exclude<NodeType, 'root'>>(args: {
  state: WritableState
  type: T
  parentKey: Key
  jsonValue: JSONValue<T>
}): Key<T>
export function insert({
  state,
  type,
  parentKey,
  jsonValue,
}: {
  state: WritableState
  type: Exclude<NodeType, 'root'>
  parentKey: Key
  jsonValue: JSONValue<Exclude<NodeType, 'root'>>
}): Key {
  if (Array.isArray(jsonValue)) {
    return state.insert(type, parentKey, (key) =>
      jsonValue.map((child) =>
        insert({ state, type: 'paragraph', parentKey: key, jsonValue: child }),
      ),
    )
  } else if (typeof jsonValue === 'string') {
    const text = new Y.Text()
    text.insert(0, jsonValue)

    return state.insert('text', parentKey, () => text)
  } else {
    return state.insert(type, parentKey, (key) =>
      insert({
        state,
        type: 'text',
        parentKey: key,
        jsonValue: jsonValue.value,
      }),
    )
  }
}
