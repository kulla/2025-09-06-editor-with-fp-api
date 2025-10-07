import { BooleanNode } from './boolean'
import { ContentNode } from './content'
import { defineArrayNode } from './core/define-array-node'
import { defineLiteralNode } from './core/define-literal-nodes'
import { defineObjectNode } from './core/define-object-node'
import { TextNode } from './text'

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
