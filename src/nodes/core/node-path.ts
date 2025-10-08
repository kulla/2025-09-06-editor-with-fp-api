export type NoIndex = typeof NoIndex
export const NoIndex = Symbol('no-index')

export type Index = string | number | NoIndex
export type IndexPath<I> = [I, ...Index[]] | []

export const NoIndexTrait = {
  getIndexWithin(): NoIndex {
    return NoIndex
  },
}
