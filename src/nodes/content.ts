import { defineArrayNode } from './core/define-array-node'
import { ParagraphNode } from './paragraph'

export const ContentNode = defineArrayNode(ParagraphNode).finish('content')
