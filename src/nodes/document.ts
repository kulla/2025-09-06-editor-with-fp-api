import { defineArrayNode } from './core/define-array-node'
import { defineUnionNode } from './core/define-union-node'
import { MultipleChoiceExerciseNode } from './multiple-choice'
import { ParagraphNode } from './paragraph'

export const DocumentItemType = defineUnionNode(
  [ParagraphNode, MultipleChoiceExerciseNode],
  (json) => json.type,
).finish('documentItem')

export const DocumentType = defineArrayNode(DocumentItemType).finish('document')
