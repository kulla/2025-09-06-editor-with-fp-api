import { isKey, type Key } from './store/types'

export interface Cursor {
  start: Point
  end: Point
}

export interface Point {
  key: Key
  index?: number
}

export function getCursor(selection: Selection | null): Cursor | null {
  if (selection == null || selection.rangeCount === 0) return null

  const range = selection.getRangeAt(0)

  const startPoint = getPoint(range.startContainer, range.startOffset)
  const endPoint = getPoint(range.endContainer, range.endOffset)

  if (startPoint == null || endPoint == null) return null

  return { start: startPoint, end: endPoint }
}

export function getPoint(
  node: Node | null,
  offset: number | null,
): Point | null {
  if (node == null) return null

  const htmlNode = node instanceof HTMLElement ? node : node.parentElement

  if (htmlNode == null) return null

  const { key, type } = htmlNode.dataset

  if (!isKey(key)) return null

  return type === 'text' && offset != null ? { key, index: offset } : { key }
}
