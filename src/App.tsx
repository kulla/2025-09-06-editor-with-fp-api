import { useEffect } from 'react'
import './App.css'
import { DebugPanel } from './components/debug-panel'
import { useEditorState } from './hooks/use-editor-state'
import { insertRoot } from './nodes/insert'
import type { JSONValue, Key } from './types'

const rootKey: Key<'root'> = 'root:1'
const initialValue: JSONValue<'root'> = {
  type: 'document',
  document: 'Hello, world!',
}
export default function App() {
  const { state } = useEditorState()

  useEffect(() => {
    setTimeout(() => {
      if (!state.has(rootKey)) {
        state.update((transaction) =>
          insertRoot(transaction, rootKey, initialValue),
        )
      }
    }, 1000)
  }, [state])

  return (
    <main className="prose p-10">
      <h1>Rsbuild with React</h1>
      <p>Start building amazing things with Rsbuild.</p>
      <DebugPanel
        labels={{ entries: 'Internal state' }}
        showOnStartup={{ entries: true }}
        getCurrentValue={{
          entries: () =>
            state
              .getEntries()
              .map(([key, entry]) => `${key}: ${JSON.stringify(entry)}`)
              .join('\n'),
        }}
      />
    </main>
  )
}
