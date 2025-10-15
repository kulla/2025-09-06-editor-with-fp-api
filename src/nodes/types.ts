import type { Command, CommandPayload } from '../commands'
import type { Guard } from '../guards'
import { Cursor } from '../selection'
import type { EditorStore } from '../store/store'
import type { FlatValue, Key, NonRootKey, Transaction } from '../store/types'
import type { Index, IndexPath } from './node-path'

export interface NodeType<J = unknown, F = FlatValue> {
  FlatValueType?: F
  JsonValueType?: J

  typeName: string

  isValidFlatValue: Guard<F>
  getFlatValue(store: EditorStore, key: Key): F
  getParentKey(store: EditorStore, key: Key): Key | null
  toJsonValue(store: EditorStore, key: Key): J
  getIndexWithin(store: EditorStore, key: Key, childKey: Key): Index

  [Command.InsertText]: OnCommand<Command.InsertText>
  [Command.Delete]: OnCommand<Command.Delete>
}

type OnCommand<C extends Command> = (
  ctx: {
    tx: Transaction
    // TODO: We should find a way that the type does not need to be passed here
    store: EditorStore
    key: Key
  },
  start: IndexPath,
  end: IndexPath,
  ...args: CommandPayload<C>
) => boolean

export interface NonRootNodeType<J = unknown, F = FlatValue>
  extends NodeType<J, F> {
  render(
    store: EditorStore,
    key: Key,
    cursor: Cursor<IndexPath> | null,
  ): React.ReactNode
  store(tx: Transaction, json: J, parentKey: Key): NonRootKey
}

export type JSONValue<T extends NodeType> = T extends NodeType<infer J>
  ? J
  : never
