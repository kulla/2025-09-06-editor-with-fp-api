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

export interface ReadonlyState {
  has(key: Key): boolean
  get<T extends NodeType>(key: Key<T>): Entry<T>
}

export interface WritableState extends ReadonlyState {
  update<T extends NodeType>(
    key: Key<T>,
    updateFn: EntryValue<T> | ((e: EntryValue<T>) => EntryValue<T>),
  ): void
  insertRoot(key: Key<'root'>, value: EntryValue<'root'>): Key<'root'>
  insert<T extends Exclude<NodeType, 'root'>>(
    type: T,
    parentKey: Key<T>,
    createValue: (key: Key<T>) => EntryValue<T>,
  ): Key<T>
}
