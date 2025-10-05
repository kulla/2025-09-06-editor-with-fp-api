import '@picocss/pico/css/pico.min.css'
import './App.css'
import { invariant } from 'es-toolkit'
import { padStart } from 'es-toolkit/compat'
import { useEffect, useRef, useSyncExternalStore } from 'react'
import * as Y from 'yjs'
import { DebugPanel } from './components/debug-panel'

let ydoc: Y.Doc | null = null

function getSingletonYDoc() {
  if (!ydoc) {
    ydoc = new Y.Doc()
  }
  return ydoc
}

type Key = `${number}` | 'root'

function isKey(value: unknown): value is Key {
  return (
    typeof value === 'string' &&
    (value === 'root' || /^[1-9][0-9]*$/.test(value))
  )
}

type PrimitiveValue = string | number | boolean
type FlatValue = PrimitiveValue | Y.Text | Key | Key[] | Record<string, Key>

interface Transaction {
  update<F extends FlatValue>(
    validator: (value: FlatValue) => value is F,
    key: Key,
    updateFn: F | ((current: F) => F),
  ): void
  attachRoot(rootKey: Key, value: Key): Key
  insert<T extends string>(
    typeName: T,
    parentKey: Key,
    createValue: (key: Key) => FlatValue,
  ): Key
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

  private generateNextKey(): Key {
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
  isValidFlatValue(value: FlatValue): value is S['FlatValue']
  toJsonValue(store: EditorStore, key: Key): S['JSONValue']
  store(tx: Transaction, json: S['JSONValue'], key: Key): Key
}

type Spec<T extends NodeType> = T extends NodeType<infer S> ? S : never

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
}

/*
function WrappedNode<T extends string, C extends NonRootType>(
  typeName: T,
  childType: C,
): WrappedNodeType<T, Spec<C>> {
  return {
    typeName,

    ...NonRootNode<WrappedNodeSpec<T, Spec<C>>>(),

    isValidFlatValue(value) {
      return isNonRootKey(value, childType.typeName)
    },

    toJsonValue(node) {
      const value = childType.toJsonValue(this.getChild(node))

      return { type: typeName, value }
    },

    getChild(node) {
      return { store: node.store, key: this.getFlatValue(node) }
    },

    storeNonRoot(jsonValue, tx, parentKey) {
      return tx.insert(typeName, parentKey, (key) =>
        childType.storeNonRoot(jsonValue.value, tx, key),
      )
    },
  }
}

const ParagraphType = WrappedNode('paragraph', TextType)

type ArrayNodeSpec<T extends string, C extends NonRootSpec> = NonRootSpec<{
  TypeName: T
  FlatValue: NonRootKey<C['TypeName']>[]
  JSONValue: C['JSONValue'][]
}>

interface ArrayNodeType<T extends string, C extends NonRootSpec>
  extends NonRootType<ArrayNodeSpec<T, C>> {
  getChildren(node: FlatNode<ArrayNodeSpec<T, C>>): FlatNode<C>[]
}

function isArrayOf<C>(
  value: unknown,
  itemValidator: (v: unknown) => v is C,
): value is C[] {
  return Array.isArray(value) && value.every(itemValidator)
}

function ArrayNode<T extends string, C extends NonRootType>(
  typeName: T,
  childType: C,
): ArrayNodeType<T, Spec<C>> {
  return {
    typeName,

    ...NonRootNode<ArrayNodeSpec<T, Spec<C>>>(),

    isValidFlatValue(value) {
      return isArrayOf(value, (v) => isNonRootKey(v, childType.typeName))
    },

    toJsonValue(node) {
      return this.getChildren(node).map((child) => childType.toJsonValue(child))
    },

    getChildren(node) {
      return this.getFlatValue(node).map((key) => ({ store: node.store, key }))
    },

    storeNonRoot(jsonValue, tx, parentKey) {
      return tx.insert(typeName, parentKey, (key) =>
        jsonValue.map((item) => childType.storeNonRoot(item, tx, key)),
      )
    },
  }
}

const ContentType = ArrayNode('content', ParagraphType)

*/

function RootType<C extends NodeSpec>(
  childType: NodeType<C>,
): NodeType<{
  TypeName: 'root'
  FlatValue: Key
  JSONValue: C['JSONValue']
  ParentKey: null
}> {
  return {
    typeName: 'root' as const,

    isValidFlatValue: isKey,

    toJsonValue(store, key) {
      const value = store.getValue(this.isValidFlatValue, key)
      return childType.toJsonValue(store, value)
    },

    store(tx, json, rootKey) {
      return tx.attachRoot(rootKey, childType.store(tx, json, rootKey))
    },
  }
}

type AppRootType = typeof AppRootType
const AppRootType = RootType(TextType)
const initialValue: Spec<AppRootType>['JSONValue'] = 'Hello, Rsbuild!'
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
      <h1>Rsbuild with React</h1>
      <p>Start building amazing things with Rsbuild.</p>
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
