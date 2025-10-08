import type { Key } from '../../store/types'

export type Path = PathFrame[]
type PathFrame = { key: Key; index?: Index }

export type Index = string | number | never
export type IndexPath = [Index, ...Index[]] | []

export const NoIndexTrait = {
  getIndexWithin(): never {
    return undefined as never
  },
}
