export type Index = string | number | never
export type IndexPath = [Index, ...Index[]] | []

export const NoIndexTrait = {
  getIndexWithin(): never {
    return undefined as never
  },
}
