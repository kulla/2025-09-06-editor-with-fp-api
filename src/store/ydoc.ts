import * as Y from 'yjs'

let ydoc: Y.Doc | null = null
let ydocPromise: Promise<Y.Doc> | null = null

export function getSingletonYDoc() {
  if (!ydoc) {
    ydoc = new Y.Doc()
  }
  return ydoc
}

export function loadYDoc(): Promise<Y.Doc> {
  if (ydocPromise) {
    return ydocPromise
  }

  ydocPromise = Promise.resolve().then(() => {
    if (!ydoc) {
      ydoc = new Y.Doc()
    }
    return ydoc
  })

  return ydocPromise
}
