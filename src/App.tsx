import '@picocss/pico/css/pico.min.css'
import './App.css'
import { O } from 'ts-toolbelt'
import { invariant, isBoolean, isString } from 'es-toolkit'
import { padStart } from 'es-toolkit/compat'
import { useEffect, useRef, useSyncExternalStore } from 'react'
import * as Y from 'yjs'
import { DebugPanel } from './components/debug-panel'
import { type Guard, isArrayOf, isTupleOf, isNumber } from './guards'
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

type MergeRight<A, B> = {
  [K in keyof A | keyof B]: K extends keyof B
    ? B[K]
    : K extends keyof A
      ? A[K]
      : never
} & unknown

function mergeRight<A, B>(a: A, b: B): MergeRight<A, B> {
  return { ...a, ...b } as MergeRight<A, B>
}

type Abstract<T extends object> = {
  [K in keyof T]?: T[K] extends (...args: infer A) => infer R
    ? (this: T, ...args: A) => R
    : T[K]
}

class TypeBuilder<T extends object, I extends object> {
  constructor(public readonly impl: I) {}

  extend<I2 extends Abstract<T>>(ext: I2 | ((Base: I) => I2)) {
    const newImpl = typeof ext === 'function' ? ext(this.impl) : ext

    return new TypeBuilder<T, MergeRight<I, I2>>(mergeRight(this.impl, newImpl))
  }

  extendType<T2 extends object>() {
    return new TypeBuilder<MergeRight<T, T2>, I>(this.impl)
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
  __Flat?: F
  __Json?: J

  typeName: string

  isValidFlatValue: Guard<F>
  getFlatValue(store: EditorStore, key: Key): F
  getParentKey(store: EditorStore, key: Key): Key | null
  render(store: EditorStore, key: Key): React.ReactNode
  toJsonValue(store: EditorStore, key: Key): J
}

type JSONValue<T extends NodeType> = T extends NodeType<FlatValue, infer J>
  ? J
  : never

function createNode<J, F extends FlatValue>() {
  return TypeBuilder.begin<NodeType<J, F>>().extend({
    __Flat: undefined,
    __Json: undefined,

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

function createNonRoot<J, F extends FlatValue>() {
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

const TextType = createNonRoot<string, Y.Text>()
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
        <span key={key} id={key} data-key={key}>
          {this.toJsonValue(store, key)}
        </span>
      )
    },
  })
  .finish('text')

function createPrimitive<V extends PrimitiveValue>(guard: Guard<V>) {
  return createNonRoot<V, V>()
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

const StringType = createPrimitive(isString)
  .extend({
    render(store, key) {
      return (
        <input
          key={key}
          id={key}
          data-key={key}
          type="text"
          value={this.getFlatValue(store, key)}
          onChange={(e) => {
            store.update((tx) => {
              this.updateValue(tx, key, e.target.value)
            })
          }}
        />
      )
    },
  })
  .finish('string')

const NumberType = createPrimitive(isNumber)
  .extend({
    render(store, key) {
      return (
        <input
          key={key}
          id={key}
          data-key={key}
          type="number"
          value={this.getFlatValue(store, key)}
          onChange={(e) => {
            const newValue = parseFloat(e.target.value)

            if (Number.isNaN(newValue)) return

            store.update((tx) => {
              this.updateValue(tx, key, newValue)
            })
          }}
        />
      )
    },
  })
  .finish('number')

const BooleanType = createPrimitive(isBoolean)
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
  return createPrimitive((v): v is T => v === value).extend({
    render() {
      return null
    },
  })
}

function createWrappedNode<T extends string, CJ>(
  typeName: T,
  childType: NonRootNodeType<CJ, FlatValue>,
) {
  return createNonRoot<{ type: T; value: CJ }, NonRootKey>()
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

const ParagraphType = createWrappedNode('paragraph', TextType)
  .extend({ HtmlTag: 'p' })
  .finish('paragraph')

function createArrayNode<CJ>(childType: NonRootNodeType<CJ, FlatValue>) {
  return createNonRoot<CJ[], NonRootKey[]>()
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

const Content = createArrayNode(ParagraphType).finish('content')

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

const MultipleChoiceAnswersType = createArrayNode(
  'multipleChoiceAnswers',
  MultipleChoiceAnswerType,
)

const MultipleChoiceExerciseType = ObjectNode(
  'multipleChoiceExercise',
  {
    type: createLiteralNode('multipleChoiceExercise'),
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
const DocumentType = createArrayNode('document', DocumentItemType)

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
