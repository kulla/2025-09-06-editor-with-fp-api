import {takeWhile, zip} from 'es-toolkit'
import {getNodeType} from './nodes/concrete-node-types'
import {getPathToRoot, type IndexPath, type Path} from './nodes/node-path'
import type {EditorStore} from './store/store'

export enum Command {
  InsertText = 'insertText',
  DeleteBackward = 'deleteBackward',
  DeleteForward = 'deleteForward',
}

interface CommandPayloads {
  [Command.InsertText]: [string]
}

export type CommandPayload<C extends Command> = C extends keyof CommandPayloads
  ? CommandPayloads[C]
  : []

export function dispatchCommand<C extends Command>(
  store: EditorStore,
  command: C,
  ...payload: CommandPayload<C>
): boolean {
  return store.update((tx) => {
    const cursor = store.getCursor()

    if (cursor == null) return true

    /*if (command !== Command.DeleteRange && !isCollapsed(tx.cursor)) {
        const result = this.dispatchCommand(Command.DeleteRange)

        if (!result) return false
        if (
          command === Command.DeleteBackward ||
          command === Command.DeleteForward
        ) {
          // If we delete a range, we don't need to handle backward or forward deletion
          return true
        }
      }*/

    const {start, end} = cursor
    const startPath = getPathToRoot(store, start)
    const endPath = getPathToRoot(store, end)

    const commonPath: Path = takeWhile(
      zip(startPath, endPath),
      ([a, b]) => a.key === b.key,
    ).map(([a, _]) => a)

    const startIndex = startPath
      .slice(Math.max(commonPath.length - 1, 0))
      .map(({index}) => index)
    const endIndex = endPath
      .slice(Math.max(commonPath.length - 1, 0))
      .map(({index}) => index)

    let targetKey = commonPath.pop()?.key ?? startPath[0].key

    while (true) {
      const targetType = getNodeType(store, targetKey)
      // TODO: Remove type assertions when possible
      const result = targetType[command](
        {tx, store, key: targetKey},
        startIndex as IndexPath,
        endIndex as IndexPath,
        // @ts-expect-error
        ...payload,
      )

      if (result) return true

      const nextTarget = commonPath.pop()

      if (nextTarget == null) break

      startIndex.unshift(nextTarget.index)
      endIndex.unshift(nextTarget.index)
      targetKey = nextTarget.key
    }

    return false
  })
}
