export type Guard<T> = (value: unknown) => value is T

export const isBoolean: Guard<boolean> = (value) => typeof value === 'boolean'
export const isString: Guard<string> = (value) => typeof value === 'string'
export const isNumber: Guard<number> = (value) => typeof value === 'number'

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

export const isKeyOf =
  <C extends Record<string, unknown>>(obj: C): Guard<keyof C> =>
  (value: unknown): value is keyof C =>
    typeof value === 'string' && value in obj

export const isIntersectionOf =
  <A, B>(guardA: Guard<A>, guardB: Guard<B>): Guard<A & B> =>
  (value): value is A & B =>
    guardA(value) && guardB(value)
