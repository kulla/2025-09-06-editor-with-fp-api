export type Guard<T> = (value: unknown) => value is T

export const isBoolean: Guard<boolean> = (value) => typeof value === 'boolean'
export const isString: Guard<string> = (value) => typeof value === 'string'

export const isArrayOf =
  <C>(itemGuard: Guard<C>): Guard<C[]> =>
  (value) =>
    Array.isArray(value) && value.every(itemGuard)

export const isTupleOf =
  <C, D>(guard1: Guard<C>, guard2: Guard<D>): Guard<[C, D]> =>
  (value): value is [C, D] =>
    Array.isArray(value) &&
    value.length === 2 &&
    guard1(value[0]) &&
    guard2(value[1])
