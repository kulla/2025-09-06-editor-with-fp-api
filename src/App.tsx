import '@picocss/pico/css/pico.min.css'
import './App.css'
import { isEqual } from 'es-toolkit'
import { padStart } from 'es-toolkit/compat'
import { icons } from 'feather-icons'
import { html as beautifyHtml } from 'js-beautify'
import { useCallback, useEffect } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { DebugPanel } from './components/debug-panel'
import { useEditorStore } from './hooks/use-editor-store'
import { defineRootNode } from './nodes/core/define-root-node'
import type { JSONValue } from './nodes/core/types'
import { DocumentItemType, DocumentType } from './nodes/document'
import { getCurrentCursor, setSelection } from './selection'
import type { NonRootKey, RootKey } from './store/types'

const AppRootType = defineRootNode(DocumentType).finish('root')
const initialValue: JSONValue<typeof AppRootType> = [
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

  useEffect(() => {
    if (store.has(rootKey)) return

    store.update((tx) => AppRootType.attachRoot(tx, rootKey, initialValue))
  }, [store])

  const updateCursorFromSelection = useCallback(() => {
    const cursor = getCurrentCursor()

    if (!isEqual(cursor, store.getCursor())) {
      store.update((state) => state.setCursor(cursor))
    }
  }, [store])

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

  const addParagraph = useCallback(() => {
    store.update((tx) => {
      const documentKey = store.getValue(
        (v): v is NonRootKey => typeof v === 'string' && v !== 'root',
        rootKey,
      )

      // Get current array of child keys
      const childKeys = store.getValue(
        (v): v is NonRootKey[] => Array.isArray(v),
        documentKey,
      )

      // Create a new paragraph item
      const newParagraphKey = DocumentItemType.store(
        tx,
        { type: 'paragraph', value: 'New paragraph...' },
        documentKey,
      )

      // Update the array with the new item
      tx.update((v): v is NonRootKey[] => Array.isArray(v), documentKey, [
        ...childKeys,
        newParagraphKey,
      ])
    })
  }, [store])

  const addMultipleChoice = useCallback(() => {
    store.update((tx) => {
      const documentKey = store.getValue(
        (v): v is NonRootKey => typeof v === 'string' && v !== 'root',
        rootKey,
      )

      // Get current array of child keys
      const childKeys = store.getValue(
        (v): v is NonRootKey[] => Array.isArray(v),
        documentKey,
      )

      // Create a new multiple choice item
      const newMCKey = DocumentItemType.store(
        tx,
        {
          type: 'multipleChoiceExercise',
          exercise: [{ type: 'paragraph', value: 'What is 2 + 2?' }],
          answers: [
            { isCorrect: false, text: '3' },
            { isCorrect: true, text: '4' },
            { isCorrect: false, text: '5' },
          ],
        },
        documentKey,
      )

      // Update the array with the new item
      tx.update((v): v is NonRootKey[] => Array.isArray(v), documentKey, [
        ...childKeys,
        newMCKey,
      ])
    })
  }, [store])

  return (
    <main className="prose p-10">
      <h1>Editor</h1>
      <div className="rounded-2xl border-2 border-blue-800 px-4">
        {store.has(rootKey) ? (
          AppRootType.render(store, rootKey)
        ) : (
          <p>Loading editor...</p>
        )}

        <div className="flex flex-row gap-2 mb-4 mt-8 border-t-2 border-t-blue-800 pt-4">
          <button
            type="button"
            onClick={addMultipleChoice}
            className="btn btn-accent"
          >
            <img
              src={`data:image/svg+xml;utf8,${encodeURIComponent(icons['check-circle'].toSvg())}`}
              className="inline mr-2"
              alt=""
            />
            Add Multiple Choice
          </button>
          <button
            type="button"
            onClick={addParagraph}
            className="btn btn-warning"
          >
            <img
              src={`data:image/svg+xml;utf8,${encodeURIComponent(icons['align-left'].toSvg())}`}
              className="inline mr-2"
              alt=""
            />
            Add Paragraph
          </button>
        </div>
      </div>
      <DebugPanel
        labels={{
          html: 'HTML representation',
          json: 'JSON representation',
          entries: 'Internal editor store',
          cursor: 'Current cursor',
        }}
        getCurrentValue={{
          html: () => {
            // Render with RenderServer
            if (!store.has(rootKey)) return ''

            const reactNode = AppRootType.render(store, rootKey)

            return beautifyHtml(renderToStaticMarkup(reactNode), {
              indent_size: 2,
              wrap_line_length: 70,
            })
          },
          json: () => {
            if (!store.has(rootKey)) return ''

            const jsonValue = AppRootType.toJsonValue(store, rootKey)
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
