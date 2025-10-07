import '@picocss/pico/css/pico.min.css'
import './App.css'
import { invariant, isBoolean, isEqual, isString } from 'es-toolkit'
import { padStart } from 'es-toolkit/compat'
import { html as beautifyHtml } from 'js-beautify'
import { useCallback, useEffect } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import * as Y from 'yjs'
import { DebugPanel } from './components/debug-panel'
import {
  type Guard,
  isArrayOf,
  isIntersectionOf,
  isKeyOf,
  isTupleOf,
} from './guards'
import { useEditorStore } from './hooks/use-editor-store'
import { defineNode } from './nodes/core/define-node'
import { defineNonRootNode } from './nodes/core/define-non-root-node'
import type { JSONValue, NonRootNodeType } from './nodes/core/types'
import { getCurrentCursor, setSelection } from './selection'
import type { EditorStore } from './store/store'
import {
  type FlatValue,
  isNonRootKey,
  type Key,
  type NonRootKey,
  type RootKey,
  type Transaction,
} from './store/types'
import type { PrimitiveValue } from './utils/types'

const TextNode = defineNonRootNode<string, Y.Text>()
  .extend({
    isValidFlatValue: (value) => value instanceof Y.Text,

    toJsonValue(store, key) {
      return this.getFlatValue(store, key).toString()
    },

    store(tx, json, parentKey) {
      return tx.insert(this.typeName, parentKey, () => new Y.Text(json))
    },

    render(store, key) {
      return (
        <span key={key} id={key} data-key={key} data-type="text">
          {this.toJsonValue(store, key)}
        </span>
      )
    },
  })
  .finish('text')

function createPrimitiveNode<V extends PrimitiveValue>(guard: Guard<V>) {
  return defineNonRootNode<V, V>()
    .extendType<{ updateValue(tx: Transaction, key: Key, newValue: V): void }>()
    .extend({
      isValidFlatValue: guard,

      toJsonValue(store, key) {
        return this.getFlatValue(store, key)
      },

      updateValue(tx, key, newValue) {
        tx.update(this.isValidFlatValue, key, newValue)
      },

      store(tx, json, parentKey) {
        return tx.insert(this.typeName, parentKey, () => json)
      },
    })
}

const BooleanNode = createPrimitiveNode(isBoolean)
  .extend({
    render(store, key) {
      const currentValue = this.getFlatValue(store, key)

      return (
        <input
          key={key}
          id={key}
          data-key={key}
          type="checkbox"
          checked={currentValue}
          onChange={(e) => {
            store.update((tx) => {
              this.updateValue(tx, key, e.target.checked)
            })
          }}
        />
      )
    },
  })
  .finish('boolean')

function createLiteralNode<T extends PrimitiveValue>(value: T) {
  return createPrimitiveNode((v): v is T => v === value).extend({
    render() {
      return null
    },
  })
}

function createWrappedNode<T extends string, CJ>(
  typeName: T,
  childType: NonRootNodeType<CJ, FlatValue>,
) {
  return defineNonRootNode<{ type: T; value: CJ }, NonRootKey>()
    .extendType<{ HtmlTag: React.ElementType }>()
    .extend({
      isValidFlatValue: isNonRootKey,

      HtmlTag: 'div',

      toJsonValue(store, key) {
        const childKey = this.getFlatValue(store, key)
        const childValue = childType.toJsonValue(store, childKey)

        return { type: typeName, value: childValue }
      },

      store(tx, json, parentKey) {
        return tx.insert(typeName, parentKey, (key) =>
          childType.store(tx, json.value, key),
        )
      },

      render(store, key) {
        const HtmlTag = this.HtmlTag
        const childKey = this.getFlatValue(store, key)

        return (
          <HtmlTag key={key} id={key} data-key={key}>
            {childType.render(store, childKey)}
          </HtmlTag>
        )
      },
    })
}

const ParagraphNode = createWrappedNode('paragraph', TextNode)
  .extend({ HtmlTag: 'p' })
  .finish('paragraph')

function createArrayNode<CJ>(childType: NonRootNodeType<CJ, FlatValue>) {
  return defineNonRootNode<CJ[], NonRootKey[]>()
    .extendType<{ HtmlTag: React.ElementType }>()
    .extend({
      isValidFlatValue: isArrayOf(isNonRootKey),

      HtmlTag: 'div',

      toJsonValue(store, key) {
        const childKeys = this.getFlatValue(store, key)
        return childKeys.map((childKey) =>
          childType.toJsonValue(store, childKey),
        )
      },

      store(tx, json, parentKey) {
        return tx.insert(this.typeName, parentKey, (key) =>
          json.map((item) => childType.store(tx, item, key)),
        )
      },

      render(store, key) {
        const HtmlTag = this.HtmlTag
        const childKeys = this.getFlatValue(store, key)

        const children = childKeys.map((childKey) =>
          childType.render(store, childKey),
        )

        return (
          <HtmlTag key={key} id={key} data-key={key}>
            {children}
          </HtmlTag>
        )
      },
    })
}

const ContentNode = createArrayNode(ParagraphNode).finish('content')

function createObjectNode<C extends Record<string, NonRootNodeType>>(
  childTypes: C,
  keyOrder: (keyof C)[],
) {
  return defineNonRootNode<
    { [K in keyof C]: JSONValue<C[K]> },
    [keyof C & string, NonRootKey][]
  >()
    .extendType<{
      HtmlTag: React.ElementType
      getPropKey(store: EditorStore, key: Key, prop: keyof C): NonRootKey
    }>()
    .extend({
      isValidFlatValue: isArrayOf(
        isTupleOf(
          isIntersectionOf(isString, isKeyOf(childTypes)),
          isNonRootKey,
        ),
      ),

      HtmlTag: 'div',

      getPropKey(store, key, prop) {
        const entries = this.getFlatValue(store, key)
        const entry = entries.find(([p]) => p === prop)

        invariant(entry, `Property ${String(prop)} not found in object ${key}`)

        return entry[1]
      },

      toJsonValue(store, key) {
        const props = this.getFlatValue(store, key).map(([prop, childKey]) => {
          const childType = childTypes[prop]

          return [prop, childType.toJsonValue(store, childKey)]
        })

        return Object.fromEntries(props) as {
          [K in keyof C]: JSONValue<C[K]>
        }
      },

      store(tx, json, parentKey) {
        return tx.insert(this.typeName, parentKey, (key) => {
          return keyOrder.map((prop) => {
            const childType = childTypes[prop]
            const childKey = childType.store(tx, json[prop], key)

            return [prop, childKey] as [keyof C & string, NonRootKey]
          })
        })
      },

      render(store, key) {
        const HtmlTag = this.HtmlTag
        const children = this.getFlatValue(store, key).map(
          ([prop, childKey]) => {
            const childType = childTypes[prop]

            return childType.render(store, childKey)
          },
        )

        return (
          <HtmlTag key={key} id={key} data-key={key} className={this.typeName}>
            {children}
          </HtmlTag>
        )
      },
    })
}

const MultipleChoiceAnswerNode = createObjectNode(
  { isCorrect: BooleanNode, text: TextNode },
  ['isCorrect', 'text'],
)
  .extend({
    render(store, key) {
      const isCorrectKey = this.getPropKey(store, key, 'isCorrect')
      const textKey = this.getPropKey(store, key, 'text')

      return (
        <li key={key} id={key} data-key={key} className={this.typeName}>
          {BooleanNode.render(store, isCorrectKey)}
          {TextNode.render(store, textKey)}
        </li>
      )
    },
  })
  .finish('multipleChoiceAnswer')

const MultipleChoiceAnswersNode = createArrayNode(MultipleChoiceAnswerNode)
  .extend({ HtmlTag: 'ul' })
  .finish('multipleChoiceAnswers')

const MultipleChoiceExerciseNode = createObjectNode(
  {
    type: createLiteralNode('multipleChoiceExercise').finish(
      'literal:multipleChoiceExercise',
    ),
    exercise: ContentNode,
    answers: MultipleChoiceAnswersNode,
  },
  ['exercise', 'answers'],
)
  .extend({
    render(store, key) {
      const exerciseKey = this.getPropKey(store, key, 'exercise')
      const answersKey = this.getPropKey(store, key, 'answers')

      return (
        <fieldset
          key={key}
          id={key}
          data-key={key}
          className="multipleChoiceExercise"
        >
          <div className="exercise block">
            <legend className="mt-2">
              <strong>Multiple Choice Exercise</strong>
            </legend>
            {ContentNode.render(store, exerciseKey)}
          </div>
          <div className="answers">
            {MultipleChoiceAnswersNode.render(store, answersKey)}
          </div>
        </fieldset>
      )
    },
  })
  .finish('multipleChoiceExercise')

function createUnionNode<
  C extends [NonRootNodeType, NonRootNodeType, ...NonRootNodeType[]],
>(childTypes: C, getTypeName: (json: JSONValue<C[number]>) => string) {
  function getChildType(childTypeName: string) {
    const childType = childTypes.find((ct) => ct.typeName === childTypeName)

    invariant(childType, 'No matching child type found')

    return childType
  }

  return defineNonRootNode<JSONValue<C[number]>, NonRootKey>().extend({
    isValidFlatValue: isNonRootKey,

    toJsonValue(store, key) {
      const childKey = this.getFlatValue(store, key)
      const childType = getChildType(store.getTypeName(childKey))

      return childType.toJsonValue(store, childKey) as JSONValue<C[number]>
    },

    store(tx, json, parentKey) {
      const childType = getChildType(getTypeName(json))

      return tx.insert(this.typeName, parentKey, (key) =>
        childType.store(tx, json, key),
      )
    },

    render(store, key) {
      const childKey = this.getFlatValue(store, key)
      const childType = getChildType(store.getTypeName(childKey))

      return childType.render(store, childKey)
    },
  })
}

const DocumentItemType = createUnionNode(
  [ParagraphNode, MultipleChoiceExerciseNode],
  (json) => json.type,
).finish('documentItem')

const DocumentType = createArrayNode(DocumentItemType).finish('document')

function RootType<CJ>(childType: NonRootNodeType<CJ>) {
  return defineNode<CJ, NonRootKey>()
    .extendType<{
      attachRoot(tx: Transaction, rootKey: RootKey, json: CJ): void
    }>()
    .extend({
      isValidFlatValue: isNonRootKey,

      toJsonValue(store, key) {
        const childKey = store.getValue(this.isValidFlatValue, key)
        return childType.toJsonValue(store, childKey)
      },

      attachRoot(tx, rootKey, json) {
        tx.attachRoot(rootKey, childType.store(tx, json, rootKey))
      },

      render(store, key) {
        const childKey = this.getFlatValue(store, key)
        return (
          <article
            key={key}
            id={key}
            data-key={key}
            contentEditable
            suppressContentEditableWarning
            spellCheck={false}
          >
            {childType.render(store, childKey)}
          </article>
        )
      },
    })
}

type AppRootType = typeof AppRootType
const AppRootType = RootType(DocumentType).finish('root')
const initialValue: JSONValue<AppRootType> = [
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

  return (
    <main className="p-10">
      <h1>Editor</h1>
      {store.has(rootKey) ? (
        AppRootType.render(store, rootKey)
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
