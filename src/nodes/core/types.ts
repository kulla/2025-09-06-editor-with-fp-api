import type { Command, CommandPayload } from '../../commands'
import type { Guard } from '../../guards'
import type { EditorStore } from '../../store/store'
import type { FlatValue, Key, NonRootKey, Transaction } from '../../store/types'
import type { Index, IndexPath } from './node-path'

export interface NodeType<J = unknown, I = Index, F = FlatValue> {
  FlatValueType?: F
  JsonValueType?: J

  typeName: string

  isValidFlatValue: Guard<F>
  getFlatValue(store: EditorStore, key: Key): F
  getParentKey(store: EditorStore, key: Key): Key | null
  render(store: EditorStore, key: Key): React.ReactNode
  toJsonValue(store: EditorStore, key: Key): J
  getIndexWithin(store: EditorStore, key: Key, childKey: NonRootKey): I

  onCommand?: {
    [C in Command]?: (
      tx: Transaction,
      // TODO: We should find a way that the type does not need to be passed here
      //type: NodeType<J, F, I>,
      store: EditorStore,
      key: Key,
      start: IndexPath<I>,
      end: IndexPath<I>,
      ...args: C extends Command ? CommandPayload<C> : []
    ) => boolean
  }
}

export interface NonRootNodeType<J = unknown, I = Index, F = FlatValue>
  extends NodeType<J, I, F> {
  store(tx: Transaction, json: J, parentKey: Key): NonRootKey
}

export type JSONValue<T extends NodeType> = T extends NodeType<infer J>
  ? J
  : never
