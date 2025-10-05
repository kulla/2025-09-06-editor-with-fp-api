import * as Y from 'yjs'

let ydoc: Y.Doc | null = null

export function getSingletonYDoc() {
  if (!ydoc) {
    ydoc = new Y.Doc()
  }
  return ydoc
}
