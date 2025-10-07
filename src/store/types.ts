import type { Text } from 'yjs'
import type { Guard } from '../guards'
import type { PrimitiveValue } from '../utils/types'

export type RootKey = 'root'
export type NonRootKey = `${number}:${number}`
export type Key = RootKey | NonRootKey

export const isNonRootKey = (value: unknown): value is NonRootKey =>
  typeof value === 'string' && /^[0-9]+$/.test(value)

// TODO: Maybe we can remove this type or simplify it
export type FlatValue =
  | PrimitiveValue
  | Text
  | NonRootKey
  | NonRootKey[]
  | [string, NonRootKey][]

export interface Transaction {
  update<F extends FlatValue>(
    guard: Guard<F>,
    key: Key,
    updateFn: F | ((current: F) => F),
  ): void
  attachRoot(rootKey: RootKey, value: NonRootKey): void
  insert<T extends string>(
    typeName: T,
    parentKey: Key,
    createValue: (key: NonRootKey) => FlatValue,
  ): NonRootKey
}
