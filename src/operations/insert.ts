import { invariant } from 'es-toolkit'
import * as Y from 'yjs'
import type {
  ContentNode,
  EditorNode,
  JSONValue,
  Key,
  NodeType,
  ParagraphNode,
  ParentKey,
  RootNode,
  TextNode,
  WritableState,
} from '../types'

export function insertRoot(
  state: WritableState,
  key: Key<RootNode>,
  value: JSONValue<RootNode>,
): Key<RootNode> {
  invariant(!state.has(key), `Root with key "${key}" is already stored`)

  state.insertRoot(
    key,
    insert(state, 'content', key, value.document) as Key<ContentNode>,
  )

  return key
}

export function insert<N extends Exclude<EditorNode, RootNode>>(
  state: WritableState,
  type: NodeType<N>,
  parentKey: ParentKey<N>,
  value: JSONValue<N>,
): Key<N> {
  if (type === 'content' && Array.isArray(value)) {
    return state.insert<ContentNode>(
      'content',
      parentKey as ParentKey<ContentNode>,
      (key) =>
        value.map((child) =>
          insert<ParagraphNode>(state, 'paragraph', key, child),
        ),
    )
  } else if (typeof value === 'string') {
    const text = new Y.Text()
    text.insert(0, value)

    return state.insert(type, parentKey, () => text)
  } else {
    return state.insert<ParagraphNode>(
      'paragraph',
      parentKey as ParentKey<ParagraphNode>,
      (key) =>
        insert<TextNode>(
          state,
          'text',
          key,
          (value as JSONValue<ParagraphNode>).value,
        ),
    )
  }
}
