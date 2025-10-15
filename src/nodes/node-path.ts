import type { Cursor, Point } from '../selection'
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

export interface TreeCursor {
  selection: Cursor<IndexPath> | null
  nodePath: IndexPath
}

export function getTreeCursor(store: EditorStore): TreeCursor {
  const cursor = store.getCursor()

  if (cursor == null) {
    return { selection: null, nodePath: [] }
  }

  const { start, end } = cursor

  return {
    selection: {
      start: getIndexPath(store, start),
      end: getIndexPath(store, end),
    },
    nodePath: [],
  }
}

export function pushIndex({ selection, nodePath }: TreeCursor, index: Index) {
  return { selection, nodePath: [...nodePath, index] }
}

function getIndexPath(store: EditorStore, point: Point): IndexPath {
  const result: IndexPath = []

  let currentKey: Key | null = point.key

  while (currentKey != null) {
    const parentKey = store.getParentKey(currentKey)

    if (parentKey == null) break

    const type = getNodeType(store, parentKey)
    const index = type.getIndexWithin(store, parentKey, currentKey)

    result.unshift(index)

    currentKey = parentKey
  }

  return result
}
