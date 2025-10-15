import type { Cursor, Point } from '../selection'
import type { EditorStore } from '../store/store'
import type { Key } from '../store/types'
import { getNodeType } from './concrete-node-types'

export type Path = PathFrame[]
type PathFrame = { key: Key; index?: Index }

export type Index = string | number | never
export type IndexPath = [Index, ...Index[]] | []

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

export function shiftIndexRange(
  cursor: Cursor<IndexPath> | null,
): Cursor<IndexPath> | null {
  if (cursor === null) return null

  return {
    start: cursor.start.slice(1) as IndexPath,
    end: cursor.end.slice(1) as IndexPath,
  }
}

export function caluclateIndexPath(
  store: EditorStore,
  cursor: Cursor | null,
): Cursor<IndexPath> | null {
  if (cursor == null) return null

  return {
    start: getIndexPathToRoot(store, cursor.start.key),
    end: getIndexPathToRoot(store, cursor.end.key),
  }
}

// TODO: Mergeable with getPathToRoot()?!
function getIndexPathToRoot(store: EditorStore, key: Key): IndexPath {
  const result: Index[] = []
  let parentKey = store.getParentKey(key)

  while (parentKey != null) {
    const parentType = getNodeType(store, parentKey)
    const index = parentType.getIndexWithin(store, parentKey, key)
    result.unshift(index)

    key = parentKey
    parentKey = store.getParentKey(key)
  }

  return result as IndexPath
}
