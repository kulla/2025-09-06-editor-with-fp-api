import { defineWrappedNode } from './core/define-wrapped-node'
import { TextNode } from './text'

export const ParagraphNode = defineWrappedNode('paragraph', TextNode)
  .extend({ HtmlTag: 'p' })
  .finish('paragraph')
