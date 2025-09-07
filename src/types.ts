import type { Text } from 'yjs'

interface NodeDescription {
  type: string
  jsonValue: unknown
  entryValue: object | string | number | boolean
}
type KeyValue<T extends string> = `${T}:${number}`

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

export const RootNode = new EditorNode<{
  type: 'root'
  jsonValue: { type: 'document'; document: ContentNode['jsonValue'] }
  entryValue: KeyValue<'content'>
}>('root')
export type RootNode = typeof RootNode

const RegisteredNode = [RootNode, TextNode, ParagraphNode, ContentNode] as const
type RegisteredNode = (typeof RegisteredNode)[number]

/*const EditorNodeMap = Object.fromEntries(
  RegisteredNode.map((node) => [node.type, node]),
) as {
  [K in RegisteredNode['type']]: Extract<RegisteredNode, { type: K }>
}
type EditorNodeMap = typeof EditorNodeMap*/

export type NodeType<N extends EditorNode = RegisteredNode> = N['type']
export type Key<N extends EditorNode = RegisteredNode> =
  `${NodeType<N>}:${number}`

export type JSONValue<N extends EditorNode> = N['jsonValue']
export type EntryValue<N extends EditorNode> = N['entryValue']
export type ParentKey<N extends EditorNode> = N extends RootNode ? null : Key

export interface Entry<N extends EditorNode = RegisteredNode> {
  type: NodeType<N>
  key: Key<N>
  parentKey: ParentKey<N>
  value: EntryValue<N>
}

export interface ReadonlyState {
  has(key: Key): boolean
  get<N extends EditorNode>(key: Key<N>): Entry<N>
}

export interface WritableState extends ReadonlyState {
  update<N extends EditorNode>(
    key: Key<N>,
    updateFn: EntryValue<N> | ((e: EntryValue<N>) => EntryValue<N>),
  ): void
  insertRoot(key: Key<RootNode>, value: EntryValue<RootNode>): Key<RootNode>
  insert<N extends Exclude<EditorNode, RootNode>>(
    type: NodeType<N>,
    parentKey: ParentKey<N>,
    createValue: (key: Key<N>) => EntryValue<N>,
  ): Key<N>
}
