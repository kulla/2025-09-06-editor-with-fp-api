import { isBoolean } from 'es-toolkit'
import * as Y from 'yjs'
import { defineArrayNode } from './core/define-array-node'
import { defineLiteralNode } from './core/define-literal-nodes'
import { defineNonRootNode } from './core/define-non-root-node'
import { defineObjectNode } from './core/define-object-node'
import { definePrimitiveNode } from './core/define-primitive-node'
import { defineRootNode } from './core/define-root-node'
import { defineUnionNode } from './core/define-union-node'
import { defineWrappedNode } from './core/define-wrapped-node'
import { NoIndexTrait } from './core/node-path'

export const TextNode = defineNonRootNode<string, Y.Text>()
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
  .extend(NoIndexTrait)
  .finish('text')

export const BooleanNode = definePrimitiveNode(isBoolean)
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

export const ParagraphNode = defineWrappedNode('paragraph', TextNode)
  .extend({ HtmlTag: 'p' })
  .finish('paragraph')

export const ContentNode = defineArrayNode(ParagraphNode).finish('content')

export const MultipleChoiceAnswerNode = defineObjectNode(
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

export const MultipleChoiceAnswersNode = defineArrayNode(
  MultipleChoiceAnswerNode,
)
  .extend({ HtmlTag: 'ul' })
  .finish('multipleChoiceAnswers')

export const MultipleChoiceExerciseNode = defineObjectNode(
  {
    type: defineLiteralNode('multipleChoiceExercise').finish(
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

export const DocumentItemNode = defineUnionNode(
  [ParagraphNode, MultipleChoiceExerciseNode],
  (json) => json.type,
).finish('documentItem')

export const DocumentNode = defineArrayNode(DocumentItemNode).finish('document')

export const RootNode = defineRootNode(DocumentNode).finish('root')
