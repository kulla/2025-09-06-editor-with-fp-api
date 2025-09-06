import type {
  Entry,
  EntryValue,
  Key,
  NodeType,
  ParentKey,
  WritableState,
} from '../types'

export class Transaction implements WritableState {
  constructor(
    public readonly has: (key: Key) => boolean,
    public readonly get: <T extends NodeType>(key: Key<T>) => Entry<T>,
    private readonly set: <T extends NodeType>(
      key: Key<T>,
      entry: Entry<T>,
    ) => void,
    private readonly generateKey: <T extends NodeType>(type: T) => Key<T>,
  ) {}

  update<T extends NodeType>(
    key: Key<T>,
    updateFn: EntryValue<T> | ((v: EntryValue<T>) => EntryValue<T>),
  ) {
    const { type, parentKey, value } = this.get(key)
    const newValue = typeof updateFn === 'function' ? updateFn(value) : updateFn

    this.set(key, { type, key, parentKey, value: newValue })
  }

  insertRoot(key: Key<'root'>, value: EntryValue<'root'>): Key<'root'> {
    this.set(key, { type: 'root', key, parentKey: null, value })
    return key
  }

  insert<T extends Exclude<NodeType, 'root'>>(
    type: T,
    parentKey: ParentKey<T>,
    createValue: (key: Key<T>) => EntryValue<T>,
  ): Key<T> {
    const key = this.generateKey(type)
    const value = createValue(key)

    this.set(key, { type, key, parentKey, value })

    return key
  }
}
