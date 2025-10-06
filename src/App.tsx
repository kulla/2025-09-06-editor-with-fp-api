import '@picocss/pico/css/pico.min.css'
import './App.css'
import { invariant, isBoolean, isString } from 'es-toolkit'
import { padStart } from 'es-toolkit/compat'
import { useEffect, useRef, useSyncExternalStore } from 'react'
import * as Y from 'yjs'
import { DebugPanel } from './components/debug-panel'
import { type Guard, isArrayOf, isTupleOf } from './guards'
import { getSingletonYDoc } from './store/ydoc'

type RootKey = 'root'
type NonRootKey = `${number}`
type Key = RootKey | NonRootKey

const isNonRootKey = (value: unknown): value is NonRootKey =>
  typeof value === 'string' && /^[1-9][0-9]*$/.test(value)

type PrimitiveValue = string | number | boolean
type FlatValue =
  | PrimitiveValue
  | Y.Text
  | NonRootKey
  | NonRootKey[]
  | [string, NonRootKey][]

interface Transaction {
  update<F extends FlatValue>(
    guard: Guard<F>,
    key: Key,
    updateFn: F | ((current: F) => F),
  ): void
  attachRoot(rootKey: RootKey, value: NonRootKey): void
  insert<T extends string>(
    typeName: T,
    parentKey: Key,
    createValue: (key: NonRootKey) => FlatValue,
  ): NonRootKey
}

export class EditorStore {
  protected readonly values: Y.Map<FlatValue>
  protected readonly parentKeys: Y.Map<Key | null>
  protected readonly state: Y.Map<unknown>
  protected readonly typeNames: Y.Map<string>
  private lastKeyNumber = 0
  private currentTransaction: Transaction | null = null

  constructor(private readonly ydoc = getSingletonYDoc()) {
    this.values = ydoc.getMap('values')
    this.parentKeys = ydoc.getMap('parentKeys')
    this.state = ydoc.getMap('state')
    this.typeNames = ydoc.getMap('typeNames')
  }

  getValue<F extends FlatValue>(
    guard: (value: FlatValue) => value is F,
    key: Key,
  ): F {
    const value = this.values.get(key)

    invariant(value != null, `Value for key ${key} not found`)
    invariant(guard(value), `Value for key ${key} has unexpected type`)

    return value
  }

  getTypeName(key: Key): string {
    const typeName = this.typeNames.get(key)

    invariant(typeName != null, `Type name for key ${key} not found`)

    return typeName
  }

  getParentKey(key: Key): Key | null {
    return this.parentKeys.get(key) ?? null
  }

  has(key: Key): boolean {
    return this.values.has(key)
  }

  getValueEntries() {
    return Array.from(this.values.entries())
  }

  get updateCount() {
    const count = this.state.get('updateCount') ?? 0

    invariant(typeof count === 'number', 'updateCount must be a number')

    return count
  }

  addUpdateListener(listener: () => void) {
    this.ydoc.on('update', listener)
  }

  removeUpdateListener(listener: () => void) {
    this.ydoc.off('update', listener)
  }

  update(updateFn: (tx: Transaction) => void) {
    if (this.currentTransaction) {
      // If we're already in a transaction, just call the update function directly
      updateFn(this.currentTransaction)
      return
    } else {
      this.ydoc.transact(() => {
        this.currentTransaction = this.createNewTransaction()

        updateFn(this.currentTransaction)

        this.incrementUpdateCount()

        this.currentTransaction = null
      })
    }
  }

  private createNewTransaction(): Transaction {
    return {
      update: (guard, key, updateFn) => {
        const currentValue = this.getValue(guard, key)
        const newValue =
          typeof updateFn === 'function' ? updateFn(currentValue) : updateFn

        this.values.set(key, newValue)
      },
      attachRoot: (rootKey, value) => {
        invariant(
          !this.has(rootKey),
          `Root key ${rootKey} already exists in the store`,
        )

        this.values.set(rootKey, value)
        this.typeNames.set(rootKey, 'root')

        return rootKey
      },
      insert: (typeName, parentKey, createValue) => {
        const newKey = this.generateNextKey()
        const value = createValue(newKey)

        this.parentKeys.set(newKey, parentKey)
        this.values.set(newKey, value)
        this.typeNames.set(newKey, typeName)

        return newKey
      },
    }
  }

  private incrementUpdateCount() {
    this.state.set('updateCount', this.updateCount + 1)
  }

  private generateNextKey(): NonRootKey {
    this.lastKeyNumber += 1

    return `${this.lastKeyNumber}`
  }
}

export function useEditorStore() {
  const store = useRef(new EditorStore()).current
  const lastReturn = useRef({ store, updateCount: store.updateCount })

  return useSyncExternalStore(
    (listener) => {
      store.addUpdateListener(listener)

      return () => store.removeUpdateListener(listener)
    },
    () => {
      if (lastReturn.current.updateCount === store.updateCount) {
        return lastReturn.current
      }

      lastReturn.current = { store, updateCount: store.updateCount }

      return lastReturn.current
    },
  )
}

interface NodeSpec {
  TypeName: string
  FlatValue: FlatValue
  JSONValue: unknown
}

interface NodeType<S extends NodeSpec = NodeSpec> {
  typeName: S['TypeName']
  isValidFlatValue: Guard<S['FlatValue']>
  toJsonValue(store: EditorStore, key: Key): S['JSONValue']
  // TODO: Here the definition of "key" differs for root and non-root nodes
  store(tx: Transaction, json: S['JSONValue'], key: Key): Key
  render(store: EditorStore, key: Key): React.ReactNode
}

type Spec<T extends NodeType> = T extends NodeType<infer S> ? S : never

const BooleanType: NodeType<{
  TypeName: 'boolean'
  FlatValue: boolean
  JSONValue: boolean
}> = {
  typeName: 'boolean' as const,

  isValidFlatValue: isBoolean,

  toJsonValue(store, key) {
    return store.getValue(this.isValidFlatValue, key)
  },

  store(tx, json, parentKey) {
    return tx.insert(this.typeName, parentKey, () => json)
  },

  render(store, key) {
    const currentValue = store.getValue(this.isValidFlatValue, key)

    return (
      <input
        key={key}
        id={key}
        data-key={key}
        type="checkbox"
        checked={currentValue}
        onChange={(e) => {
          store.update((tx) => {
            tx.update(this.isValidFlatValue, key, e.target.checked)
          })
        }}
      />
    )
  },
}

const TextType: NodeType<{
  TypeName: 'text'
  FlatValue: Y.Text
  JSONValue: string
  ParentKey: Key
}> = {
  typeName: 'text' as const,

  isValidFlatValue: (value) => value instanceof Y.Text,

  toJsonValue(store, key) {
    return store.getValue(this.isValidFlatValue, key).toString()
  },

  store(tx, json, parentKey) {
    return tx.insert(this.typeName, parentKey, () => new Y.Text(json))
  },

  render(store, key) {
    const text = store.getValue(this.isValidFlatValue, key)

    return (
      <span key={key} id={key} data-key={key}>
        {text.toString()}
      </span>
    )
  },
}

function WrappedNode<T extends string, C extends NodeSpec>(
  typeName: T,
  childType: NodeType<C>,
  { HtmlTag = 'div' }: { HtmlTag?: React.ElementType } = {},
): NodeType<{
  TypeName: T
  FlatValue: NonRootKey
  JSONValue: { type: T; value: C['JSONValue'] }
}> {
  function getChild(store: EditorStore, key: Key) {
    return store.getValue(isNonRootKey, key)
  }

  return {
    typeName,

    isValidFlatValue: isNonRootKey,

    toJsonValue(store, key) {
      const value = childType.toJsonValue(store, getChild(store, key))

      return { type: typeName, value }
    },

    store(tx, { value }, parentKey) {
      return tx.insert(typeName, parentKey, (key) =>
        childType.store(tx, value, key),
      )
    },

    render(store, key) {
      return (
        <HtmlTag key={key} id={key} data-key={key}>
          {childType.render(store, getChild(store, key))}
        </HtmlTag>
      )
    },
  }
}

const ParagraphType = WrappedNode('paragraph', TextType, { HtmlTag: 'p' })

function ArrayNode<T extends string, C extends NodeSpec>(
  typeName: T,
  childType: NodeType<C>,
  { HtmlTag = 'div' }: { HtmlTag?: React.ElementType } = {},
): NodeType<{
  TypeName: T
  FlatValue: NonRootKey[]
  JSONValue: C['JSONValue'][]
}> {
  const isValidFlatValue = isArrayOf(isNonRootKey)

  const getChildren = (store: EditorStore, node: Key) =>
    store.getValue(isValidFlatValue, node)

  return {
    typeName,

    isValidFlatValue,

    toJsonValue(store, key) {
      return getChildren(store, key).map((child) =>
        childType.toJsonValue(store, child),
      )
    },

    store(tx, json, parentKey) {
      return tx.insert(typeName, parentKey, (key) =>
        // @ts-expect-error
        json.map((item) => childType.store(tx, item, key)),
      )
    },

    render(store, key) {
      const children = getChildren(store, key).map((childKey) =>
        childType.render(store, childKey),
      )

      return (
        <HtmlTag key={key} id={key} data-key={key}>
          {children}
        </HtmlTag>
      )
    },
  }
}

function LiteralNode<V extends PrimitiveValue>(
  value: V,
): NodeType<{ TypeName: `literal:${V}`; FlatValue: V; JSONValue: V }> {
  const typeName = `literal:${value}` as const

  return {
    typeName,

    isValidFlatValue: (v): v is V => v === value,

    toJsonValue() {
      return value
    },

    store(tx, json, parentKey) {
      return tx.insert(typeName, parentKey, () => json)
    },

    render() {
      return null
    },
  }
}

function ObjectNode<T extends string, C extends Record<string, NodeSpec>>(
  typeName: T,
  childTypes: { [K in keyof C]: NodeType<C[K]> },
  keyOrder: (keyof C)[],
  { HtmlTag = 'div' }: { HtmlTag?: React.ElementType } = {},
): NodeType<{
  TypeName: T
  FlatValue: [keyof C & string, NonRootKey][]
  JSONValue: { [K in keyof C]: C[K]['JSONValue'] }
}> {
  const isValidFlatValue = isArrayOf(isTupleOf(isString, isNonRootKey))
  const getChildren = (store: EditorStore, node: Key) =>
    store.getValue(isValidFlatValue, node)

  return {
    typeName,

    isValidFlatValue,

    toJsonValue(store, key) {
      const props = getChildren(store, key).map(([prop, childKey]) => {
        return [prop, childTypes[prop].toJsonValue(store, childKey)]
      })

      return { ...Object.fromEntries(props), type: typeName }
    },

    store(tx, json, parentKey) {
      return tx.insert(typeName, parentKey, (key) => {
        return keyOrder.map((prop) => {
          const childKey = childTypes[prop].store(tx, json[prop], key)

          return [prop, childKey] as [keyof C & string, NonRootKey]
        })
      })
    },

    render(store, key) {
      const children = getChildren(store, key).map(([prop, childKey]) => {
        const childType = childTypes[prop]
        return childType.render(store, childKey)
      })

      return (
        <HtmlTag key={key} id={key} data-key={key} className={typeName}>
          {children}
        </HtmlTag>
      )
    },
  }
}

const MultipleChoiceAnswerType = ObjectNode(
  'multipleChoiceAnswer',
  { isCorrect: BooleanType, text: TextType },
  ['isCorrect', 'text'],
)

const MultipleChoiceAnswersType = ArrayNode(
  'multipleChoiceAnswers',
  MultipleChoiceAnswerType,
)

const Content = ArrayNode('content', ParagraphType)

const MultipleChoiceExerciseType = ObjectNode(
  'multipleChoiceExercise',
  {
    type: LiteralNode('multipleChoiceExercise'),
    exercise: Content,
    answers: MultipleChoiceAnswersType,
  },
  ['exercise', 'answers'],
)

function UnionNode<
  T extends string,
  C extends [NodeType, NodeType, ...NodeType[]],
>(
  typeName: T,
  childTypes: C,
  getTypeName: (json: Spec<C[number]>['JSONValue']) => C[number]['typeName'],
): NodeType<{
  TypeName: T
  FlatValue: NonRootKey
  JSONValue: Spec<C[number]>['JSONValue']
}> {
  function getChildType(childTypeName: string) {
    const childType = childTypes.find((ct) => ct.typeName === childTypeName)

    invariant(childType, 'No matching child type found')

    return childType
  }

  return {
    typeName,

    isValidFlatValue: isNonRootKey,

    toJsonValue(store, key) {
      const childKey = store.getValue(isNonRootKey, key)
      const childType = getChildType(store.getTypeName(childKey))

      return childType.toJsonValue(store, childKey)
    },

    store(tx, json, parentKey) {
      const childType = getChildType(getTypeName(json))

      return tx.insert(typeName, parentKey, (key) =>
        childType.store(tx, json, key),
      )
    },

    render(store, key) {
      const childKey = store.getValue(isNonRootKey, key)
      const childType = getChildType(store.getTypeName(childKey))

      return childType.render(store, childKey)
    },
  }
}

const DocumentItemType = UnionNode(
  'documentItem',
  [ParagraphType, MultipleChoiceExerciseType],
  (json) => json.type,
)
const DocumentType = ArrayNode('document', DocumentItemType)

function RootType<C extends NodeSpec>(
  childType: NodeType<C>,
): NodeType<{
  TypeName: 'root'
  FlatValue: NonRootKey
  JSONValue: C['JSONValue']
  ParentKey: null
}> {
  return {
    typeName: 'root' as const,

    isValidFlatValue: isNonRootKey,

    toJsonValue(store, key) {
      const childKey = store.getValue(this.isValidFlatValue, key)
      return childType.toJsonValue(store, childKey)
    },

    store(tx, json, rootKey) {
      tx.attachRoot(
        rootKey as RootKey,
        childType.store(tx, json, rootKey) as NonRootKey,
      )
      return rootKey
    },

    render(store, key) {
      const childKey = store.getValue(this.isValidFlatValue, key)
      return (
        <article key={key} id={key} data-key={key}>
          {childType.render(store, childKey)}
        </article>
      )
    },
  }
}

type AppRootType = typeof AppRootType
const AppRootType = RootType(DocumentType)
const initialValue: Spec<AppRootType>['JSONValue'] = [
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
const rootKey: Key = 'root'

export default function App() {
  const { store } = useEditorStore()

  useEffect(() => {
    setTimeout(() => {
      if (store.has(rootKey)) return

      store.update((tx) => AppRootType.store(tx, initialValue, rootKey))
    }, 1000)
  }, [store])

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
          entries: 'Internal editor store',
          json: 'JSON representation',
        }}
        getCurrentValue={{
          entries: () => {
            const stringifyEntry = ([key, entry]: [string, unknown]) =>
              `${padStart(key, 11)}: ${JSON.stringify(entry)}`

            return store.getValueEntries().map(stringifyEntry).join('\n')
          },
          json: () => {
            if (!store.has(rootKey)) return ''

            const jsonValue = AppRootType.toJsonValue(store, rootKey)
            return JSON.stringify(jsonValue, null, 2)
          },
        }}
        showOnStartup={{ entries: true, json: true }}
      />
    </main>
  )
}
