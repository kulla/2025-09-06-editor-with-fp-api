import type { Text } from 'yjs'

type KeyValue<T extends string> = `${T}:${number}`

interface NodeDescription {
  type: string
  jsonValue: unknown
  entryValue: object | string | number | boolean
}

export class EditorNode<Description extends NodeDescription = NodeDescription> {
  constructor(public readonly type: Description['type']) {}

  get jsonValue(): Description['jsonValue'] {
    throw new Error('This is a type-only property')
  }

  get entryValue(): Description['entryValue'] {
    throw new Error('This is a type-only property')
  }
}

class WrappedNode<
  Type extends string,
  Child extends EditorNode,
> extends EditorNode<{
  type: Type
  jsonValue: { type: Type; value: Child['jsonValue'] }
  entryValue: KeyValue<Child['type']>
}> {
  constructor(
    type: Type,
    public readonly child: Child,
  ) {
    super(type)
  }
}

class ArrayNode<
  Type extends string,
  Child extends EditorNode,
> extends EditorNode<{
  type: Type
  jsonValue: Child['jsonValue'][]
  entryValue: KeyValue<Child['type']>[]
}> {
  constructor(
    type: Type,
    public readonly child: Child,
  ) {
    super(type)
  }
}

export const TextNode = new EditorNode<{
  type: 'text'
  jsonValue: string
  entryValue: Text
}>('text')
export type TextNode = typeof TextNode

export const ParagraphNode = new WrappedNode('paragraph', TextNode)
export type ParagraphNode = typeof ParagraphNode

export const ContentNode = new ArrayNode('content', ParagraphNode)
export type ContentNode = typeof ContentNode

export const RootNode = new WrappedNode('root', ContentNode)
export type RootNode = typeof RootNode

const RegisteredNode = [RootNode, ContentNode, ParagraphNode, TextNode] as const
type RegisteredNode = (typeof RegisteredNode)[number]

const EditorNodeMap = Object.fromEntries(
  RegisteredNode.map((node) => [node.type, node]),
) as {
  [K in RegisteredNode['type']]: Extract<RegisteredNode, { type: K }>
}
type EditorNodeMap = typeof EditorNodeMap

export type NodeType<N extends EditorNode = RegisteredNode> = N['type']
export type Key<T extends NodeType = NodeType> = KeyValue<T>

export type JSONValue<T extends NodeType = NodeType> =
  EditorNodeMap[T]['jsonValue']
export type EntryValue<T extends NodeType> = EditorNodeMap[T]['entryValue']
export type ParentKey<T extends NodeType = NodeType> = T extends 'root'
  ? null
  : Key

export type Entry<T extends NodeType = NodeType> = {
  [K in T]: EntryOfType<K>
}[T]
interface EntryOfType<T extends NodeType> {
  type: T
  key: Key<T>
  parentKey: ParentKey<T>
  value: EntryValue<T>
}

export interface ReadonlyState {
  has(key: Key): boolean
  get<T extends NodeType>(key: Key<T>): Entry<T>
}

export interface WritableState extends ReadonlyState {
  update<T extends NodeType>(
    key: Key<T>,
    updateFn: EntryValue<T> | ((e: EntryValue<T>) => EntryValue<T>),
  ): void
  insertRoot(key: Key<'root'>, value: EntryValue<'root'>): Key<'root'>
  insert<T extends Exclude<NodeType, 'root'>>(
    type: T,
    parentKey: ParentKey<T>,
    createValue: (key: Key<T>) => EntryValue<T>,
  ): Key<T>
}
