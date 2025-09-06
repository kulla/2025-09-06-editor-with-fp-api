import type { Text } from 'yjs'

interface NodeMap {
  root: {
    jsonValue: { type: 'document'; document: JSONValue<'text'> }
    entryValue: Key<'text'>
    parentKey: null
  }
  text: {
    jsonValue: string
    entryValue: Text
    parentKey: Key<'root'>
  }
}

export type NodeType = keyof NodeMap

export type Key<T extends NodeType = NodeType> = `${T}:${number}`

export type JSONValue<T extends NodeType> = NodeMap[T]['jsonValue']
export type EntryValue<T extends NodeType> = NodeMap[T]['entryValue']
export type ParentKey<T extends NodeType> = NodeMap[T]['parentKey']

export type Entry<T extends NodeType> = { [S in T]: EntryOfType<S> }[T]
interface EntryOfType<T extends NodeType> {
  type: T
  key: Key<T>
  parentKey: ParentKey<T>
  value: EntryValue<T>
}
