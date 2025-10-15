import type { Point } from '../selection'
import type { EditorStore } from '../store/store'
import type { Key } from '../store/types'
import { getNodeType } from './concrete-node-types'

export type Path = PathFrame[]
type PathFrame = { key: Key; index?: Index }

export type Index = string | number | never
export type IndexPath = Index[]

export const NoIndexTrait = {
  getIndexWithin(): never {
    return undefined as never
  },
}

export function getPathToRoot(store: EditorStore, point: Point): Path {
  const path: Path = [point]
  let parentKey = store.getParentKey(point.key)

  while (parentKey != null) {
    const index = getNodeType(store, parentKey).getIndexWithin(
      store,
      parentKey,
      path[0].key,
    )

    path.unshift({ key: parentKey, index })

    parentKey = store.getParentKey(parentKey)
  }

  return path
}
