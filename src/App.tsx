import '@picocss/pico/css/pico.min.css'
import './App.css'
import { invariant, isBoolean, isEqual, isString } from 'es-toolkit'
import { padStart } from 'es-toolkit/compat'
import { useCallback, useEffect } from 'react'
import type { O } from 'ts-toolbelt'
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
import { getCursor, setSelection } from './selection'

type Abstract<T extends object> = {
  [K in keyof T]?: T[K] extends (...args: infer A) => infer R
    ? (this: T, ...args: A) => R
    : T[K]
}

class TypeBuilder<T extends object, I extends object> {
  constructor(public readonly impl: I) {}

  extend<I2 extends Abstract<T>>(ext: I2 | ((Base: I) => I2)) {
    const extension = typeof ext === 'function' ? ext(this.impl) : ext
    const newImpl = { ...this.impl, ...extension } as O.Merge<I, I2>

    return new TypeBuilder<T, O.Merge<I, I2>>(newImpl)
  }

  extendType<T2 extends object>() {
    return new TypeBuilder<O.Merge<T, T2>, I>(this.impl)
  }

  finish(this: TypeBuilder<T, Omit<T, 'typeName'>>, typeName: string): T {
    return { ...this.impl, typeName } as T
  }

  static begin<Target extends object>(): TypeBuilder<Target, object>
  static begin<Target extends object>(impl: Target): TypeBuilder<Target, Target>
  static begin<Target extends object>(impl = {}) {
    return new TypeBuilder<Target, object>(impl)
  }
}

interface NodeType<J = unknown, F = FlatValue> {
  FlatValueType?: F
  JsonValueType?: J

  typeName: string

  isValidFlatValue: Guard<F>
  getFlatValue(store: EditorStore, key: Key): F
  getParentKey(store: EditorStore, key: Key): Key | null
  render(store: EditorStore, key: Key): React.ReactNode
  toJsonValue(store: EditorStore, key: Key): J
}

type JSONValue<T extends NodeType> = T extends NodeType<infer J> ? J : never

function createNode<J, F extends FlatValue>() {
  return TypeBuilder.begin<NodeType<J, F>>().extend({
    getFlatValue(store, key) {
      return store.getValue(this.isValidFlatValue, key)
    },

    getParentKey(store, key) {
      return store.getParentKey(key)
    },
  })
}

interface NonRootNodeType<J = unknown, F = FlatValue> extends NodeType<J, F> {
  store(tx: Transaction, json: J, parentKey: Key): NonRootKey
}

function createNonRootNode<J, F extends FlatValue>() {
  return createNode<J, F>()
    .extendType<NonRootNodeType<J, F>>()
    .extend((Base) => ({
      getParentKey(store, key) {
        const parentKey = Base.getParentKey.call(this, store, key)

        invariant(parentKey != null, `Non-root node ${key} has no parent`)

        return parentKey
      },
    }))
}

const TextNode = createNonRootNode<string, Y.Text>()
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
  return createNonRootNode<V, V>()
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
  return createNonRootNode<{ type: T; value: CJ }, NonRootKey>()
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
  return createNonRootNode<CJ[], NonRootKey[]>()
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
  return createNonRootNode<
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

  return createNonRootNode<JSONValue<C[number]>, NonRootKey>().extend({
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
  return createNode<CJ, NonRootKey>()
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
    const selection = document.getSelection()
    const cursor = getCursor(selection)

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

  // biome-ignore lint/correctness/useExhaustiveDependencies: Use updateCount to trigger re-render for each state change
  useEffect(() => {
    setSelection(store.getCursor())
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
          json: 'JSON representation',
          entries: 'Internal editor store',
          cursor: 'Current cursor',
        }}
        getCurrentValue={{
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
        showOnStartup={{ entries: true, json: true, cursor: true }}
      />
    </main>
  )
}
