import type { Guard } from '../../guards'
import type { EditorStore } from '../../store/store'
import type { FlatValue, Key, NonRootKey, Transaction } from '../../store/types'

export interface NodeType<J = unknown, F = FlatValue> {
  FlatValueType?: F
  JsonValueType?: J

  typeName: string

  isValidFlatValue: Guard<F>
  getFlatValue(store: EditorStore, key: Key): F
  getParentKey(store: EditorStore, key: Key): Key | null
  render(store: EditorStore, key: Key): React.ReactNode
  toJsonValue(store: EditorStore, key: Key): J
}

export interface NonRootNodeType<J = unknown, F = FlatValue>
  extends NodeType<J, F> {
  store(tx: Transaction, json: J, parentKey: Key): NonRootKey
}

export type JSONValue<T extends NodeType> = T extends NodeType<infer J>
  ? J
  : never
