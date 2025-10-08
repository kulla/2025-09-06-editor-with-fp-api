import * as Y from 'yjs'
import { defineNonRootNode } from './core/define-non-root-node'
import { NoIndex, NoIndexTrait } from './core/node-path'

export const TextNode = defineNonRootNode<string, NoIndex, Y.Text>()
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
