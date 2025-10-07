import { WebsocketProvider } from 'y-websocket'
import * as Y from 'yjs'

let ydoc: Y.Doc | null = null
let provider: WebsocketProvider | null = null
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

  ydocPromise = new Promise((resolve) => {
    const ydoc = getSingletonYDoc()

    if (!provider) {
      provider = new WebsocketProvider('ws://localhost:1234', 'editor', ydoc)

      provider.on('status', () => resolve(ydoc))
    } else {
      resolve(ydoc)
    }
  })

  return ydocPromise
}
