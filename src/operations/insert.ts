import { invariant } from 'es-toolkit'
import * as Y from 'yjs'
import type { JSONValue, Key, NodeType, WritableState } from '../types'

export function insertRoot(
  state: WritableState,
  key: Key<'root'>,
  { value }: JSONValue<'root'>,
): Key<'root'> {
  invariant(!state.has(key), `Root with key "${key}" is already stored`)

  state.insertRoot(
    key,
    insert({
      state,
      node: { type: 'content', jsonValue: value },
      parentKey: key,
    }),
  )

  return key
}

export function insert<T extends Exclude<NodeType, 'root'>>(args: {
  state: WritableState
  node: UnstoredNode<T>
  parentKey: Key
}): Key<T>
export function insert({
  state,
  node,
  parentKey,
}: {
  state: WritableState
  node: UnstoredNode<Exclude<NodeType, 'root'>>
  parentKey: Key
}): Key {
  if (node.type === 'content') {
    return state.insert(node.type, parentKey, (key) =>
      node.jsonValue.map((child) =>
        insert({
          state,
          node: { type: 'paragraph', jsonValue: child },
          parentKey: key,
        }),
      ),
    )
  } else if (node.type === 'text') {
    const text = new Y.Text()
    text.insert(0, node.jsonValue)

    return state.insert('text', parentKey, () => text)
  } else {
    return state.insert(node.type, parentKey, (key) =>
      insert({
        state,
        node: { type: 'text', jsonValue: node.jsonValue.value },
        parentKey: key,
      }),
    )
  }
}

type UnstoredNode<T extends NodeType> = {
  [S in T]: { type: S; jsonValue: JSONValue<S> }
}[T]
