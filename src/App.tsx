import '@picocss/pico/css/pico.min.css'
import './App.css'
import { isEqual } from 'es-toolkit'
import { padStart } from 'es-toolkit/compat'
import { html as beautifyHtml } from 'js-beautify'
import { useCallback, useEffect } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Command, dispatchCommand } from './commands'
import { DebugPanel } from './components/debug-panel'
import { useEditorStore } from './hooks/use-editor-store'
import { RootType } from './nodes/concrete-node-types'
import type { JSONValue } from './nodes/types'
import { getCurrentCursor, setSelection } from './selection'
import type { RootKey } from './store/types'

const initialValue: JSONValue<typeof RootType> = [
  { type: 'paragraph', value: 'Hello, Rsbuild!' },
  {
    type: 'paragraph',
    value: 'This is a simple rich text editor built with React and Rsbuild.',
  },
  {
    type: 'multipleChoiceExercise',
    exercise: [{ type: 'paragraph', value: 'What is the capital of France?' }],
    answers: [
      { isCorrect: false, text: 'Berlin' },
      { isCorrect: true, text: 'Paris' },
      { isCorrect: false, text: 'Madrid' },
    ],
  },
]
const rootKey: RootKey = 'root'

export default function App() {
  const { store } = useEditorStore()

  const updateCursorFromSelection = useCallback(() => {
    const cursor = getCurrentCursor()

    if (!isEqual(cursor, store.getCursor())) {
      store.update((state) => state.setCursor(cursor))
    }
  }, [store])

  const onKeyDown: React.KeyboardEventHandler = useCallback(
    (event) => {
      if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
        dispatchCommand(store, Command.InsertText, event.key)
      } else if (event.key === 'Enter') {
        //manager.dispatchCommand(Command.InsertNewElement)
      } else if (event.key === 'Backspace') {
        dispatchCommand(store, Command.Delete, 'backward')
      } else if (event.key === 'Delete') {
        dispatchCommand(store, Command.Delete, 'forward')
      }

      if (
        (event.ctrlKey && ['c', 'v', 'x'].includes(event.key.toLowerCase())) ||
        ['Enter', 'Tab', 'Delete', 'Backspace'].includes(event.key) ||
        (event.key.length === 1 && !event.ctrlKey && !event.metaKey)
      ) {
        event.preventDefault()
      }
    },
    [store],
  )

  useEffect(() => {
    document.addEventListener('selectionchange', updateCursorFromSelection)

    return () => {
      document.removeEventListener('selectionchange', updateCursorFromSelection)
    }
  }, [updateCursorFromSelection])

  useEffect(() => {
    // Use updateCount here to enforce the effect to run after each store update
    if (store.updateCount < 0) return

    const cursor = getCurrentCursor()

    if (!isEqual(cursor, store.getCursor())) {
      setSelection(store.getCursor())
    }
  }, [store, store.updateCount])

  useEffect(() => {
    if (store.has(rootKey)) return

    store.update((tx) => RootType.attachRoot(tx, rootKey, initialValue))
  }, [store])

  return (
    <main className="p-10">
      <h1>Editor</h1>
      {store.has(rootKey) ? (
        RootType.render(store, rootKey, onKeyDown)
      ) : (
        <p>Loading editor...</p>
      )}
      <DebugPanel
        labels={{
          html: 'HTML representation',
          json: 'JSON representation',
          entries: 'Internal editor store',
          cursor: 'Current cursor',
        }}
        getCurrentValue={{
          html: () => {
            if (!store.has(rootKey)) return ''

            const reactNode = RootType.render(store, rootKey, onKeyDown)

            return beautifyHtml(renderToStaticMarkup(reactNode), {
              indent_size: 2,
              wrap_line_length: 70,
            })
          },
          json: () => {
            if (!store.has(rootKey)) return ''

            const jsonValue = RootType.toJsonValue(store, rootKey)
            return JSON.stringify(jsonValue, null, 2)
          },
          entries: () => {
            const stringifyEntry = ([key, entry]: [string, unknown]) =>
              `${padStart(key, 4)}: ${JSON.stringify(entry)}`

            return store.getValueEntries().map(stringifyEntry).join('\n')
          },
          cursor: () => JSON.stringify(store.getCursor(), null, 2),
        }}
        showOnStartup={{
          entries: false,
          json: true,
          cursor: false,
          html: true,
        }}
      />
    </main>
  )
}
