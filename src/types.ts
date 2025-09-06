import type { Text } from 'yjs'

interface NodeMap {
  root: {
    jsonValue: { type: 'document'; document: JSONValue<'text'> }
    entryValue: Key<'text'>
  }
  text: {
    jsonValue: string
    entryValue: Text
  }
}

export type NodeType = keyof NodeMap

export type Key<T extends NodeType> = `${T}:${number}`

export type JSONValue<T extends NodeType> = NodeMap[T]['jsonValue']
export type EntryValue<T extends NodeType> = NodeMap[T]['entryValue']
