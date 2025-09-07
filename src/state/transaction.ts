import type {
  EditorNode,
  Entry,
  EntryValue,
  Key,
  NodeType,
  ParentKey,
  RootNode,
  WritableState,
} from '../types'

export class Transaction implements WritableState {
  constructor(
    public readonly has: (key: Key) => boolean,
    public readonly get: <N extends EditorNode>(key: Key<N>) => Entry<N>,
    private readonly set: <N extends EditorNode>(
      key: Key<N>,
      entry: Entry<N>,
    ) => void,
    private readonly generateKey: <N extends EditorNode>(
      type: NodeType<N>,
    ) => Key<N>,
  ) {}

  update<N extends EditorNode>(
    key: Key<N>,
    updateFn: EntryValue<N> | ((v: EntryValue<N>) => EntryValue<N>),
  ) {
    const { type, parentKey, value } = this.get(key)
    const newValue = typeof updateFn === 'function' ? updateFn(value) : updateFn

    this.set(key, { type, key, parentKey, value: newValue })
  }

  insertRoot(key: Key<RootNode>, value: EntryValue<RootNode>): Key<RootNode> {
    this.set<RootNode>(key, { type: 'root', key, parentKey: null, value })
    return key
  }

  insert<N extends Exclude<EditorNode, RootNode>>(
    type: NodeType<N>,
    parentKey: ParentKey<N>,
    createValue: (key: Key<N>) => EntryValue<N>,
  ): Key<N> {
    const key = this.generateKey(type)
    const value = createValue(key)

    this.set(key, { type, key, parentKey, value })

    return key
  }
}
