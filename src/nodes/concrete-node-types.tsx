import {invariant, isBoolean} from 'es-toolkit'
import * as Y from 'yjs'
import type {EditorStore} from '../store/store'
import type {Key} from '../store/types'
import {defineArrayNode} from './define-array-node'
import {defineLiteralNode} from './define-literal-nodes'
import {defineNonRootNode} from './define-non-root-node'
import {defineObjectNode} from './define-object-node'
import {definePrimitiveNode} from './define-primitive-node'
import {defineRootNode} from './define-root-node'
import {defineUnionNode} from './define-union-node'
import {defineWrappedNode} from './define-wrapped-node'
import {NoIndexTrait} from './node-path'
import type {NodeType} from './types'

export const TextType = defineNonRootNode<string, Y.Text>()
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

    insertText({tx, key}, [index], [endIndex], text) {
      if (typeof index !== 'number') return false
      if (index == null || index !== endIndex) return false

      tx.update(this.isValidFlatValue, key, (prev) => {
        prev.insert(index, text)
        return prev
      })
      tx.setCaret({key, index: index + text.length})

      return true
    },

    deleteForward({store, tx, key}, [index], [endIndex]) {
      if (typeof index !== 'number') return false
      if (index == null || index !== endIndex) return false

      const currentValue = this.getFlatValue(store, key).toString()

      if (index >= currentValue.length) return false

      tx.update(this.isValidFlatValue, key, (prev) => {
        prev.delete(index, 1)
        return prev
      })
      tx.setCaret({key: key, index})

      return true
    },

    deleteBackward({tx, key}, [index], [endIndex]) {
      if (typeof index !== 'number') return false
      if (index == null || index !== endIndex) return false
      if (index <= 0) return false

      tx.update(this.isValidFlatValue, key, (prev) => {
        prev.delete(index - 1, 1)
        return prev
      })
      tx.setCaret({key, index: index - 1})

      return true
    },
  })
  .extend(NoIndexTrait)
  .finish('text')

export const BooleanType = definePrimitiveNode(isBoolean)
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

export const ParagraphType = defineWrappedNode('paragraph', TextType)
  .extend({HtmlTag: 'p'})
  .finish('paragraph')

export const ContentType = defineArrayNode(ParagraphType).finish('content')

export const MultipleChoiceAnswerType = defineObjectNode(
  {isCorrect: BooleanType, text: TextType},
  ['isCorrect', 'text'],
)
  .extend({
    render(store, key) {
      const isCorrectKey = this.getPropKey(store, key, 'isCorrect')
      const textKey = this.getPropKey(store, key, 'text')

      return (
        <li key={key} id={key} data-key={key} className={this.typeName}>
          {BooleanType.render(store, isCorrectKey)}
          {TextType.render(store, textKey)}
        </li>
      )
    },
  })
  .finish('multipleChoiceAnswer')

export const MultipleChoiceAnswersType = defineArrayNode(
  MultipleChoiceAnswerType,
)
  .extend({HtmlTag: 'ul'})
  .finish('multipleChoiceAnswers')

export const MultipleChoiceExerciseType = defineObjectNode(
  {
    type: defineLiteralNode('multipleChoiceExercise').finish(
      'literal:multipleChoiceExercise',
    ),
    exercise: ContentType,
    answers: MultipleChoiceAnswersType,
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
            {ContentType.render(store, exerciseKey)}
          </div>
          <div className="answers">
            {MultipleChoiceAnswersType.render(store, answersKey)}
          </div>
        </fieldset>
      )
    },
  })
  .finish('multipleChoiceExercise')

export const DocumentItemType = defineUnionNode(
  [ParagraphType, MultipleChoiceExerciseType],
  (json) => json.type,
).finish('documentItem')

export const DocumentType = defineArrayNode(DocumentItemType).finish('document')

export const RootType = defineRootNode(DocumentType).finish('root')

const allNodeTypes = [
  TextType,
  BooleanType,
  ParagraphType,
  ContentType,
  MultipleChoiceAnswerType,
  MultipleChoiceAnswersType,
  MultipleChoiceExerciseType,
  DocumentItemType,
  DocumentType,
  RootType,
] as const

const nodeTypeMap: Record<string, NodeType | undefined> = Object.fromEntries(
  allNodeTypes.map((n) => [n.typeName, n]),
)

export function getNodeType(store: EditorStore, key: Key): NodeType {
  const typeName = store.getTypeName(key)
  const node = nodeTypeMap[typeName]

  invariant(node, `Unknown node type: ${typeName}`)

  return node
}
