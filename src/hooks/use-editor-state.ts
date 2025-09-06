import { useRef, useSyncExternalStore } from 'react'
import { EditorState } from '../state/editor-state'

export function useEditorState() {
  const state = useRef(new EditorState()).current
  const lastReturn = useRef({ state, updateCount: state.updateCount })

  return useSyncExternalStore(
    (listener) => {
      state.addUpdateListener(listener)

      return () => state.removeUpdateListener(listener)
    },
    () => {
      if (lastReturn.current.updateCount === state.updateCount) {
        return lastReturn.current
      }

      lastReturn.current = { state, updateCount: state.updateCount }

      return lastReturn.current
    },
  )
}
