/**
 * @purpose Remember how wide the reader wants the Home pane, and drag it there.
 * @llm-note The pane used to be `lg:w-[440px] xl:w-[500px] shrink-0` — three fixed
 *   sizes we picked. But the pane holds agent-authored HTML we do not control: one
 *   agent's Home is a four-column table, another's is a wide chart. There is no
 *   single width that fits them, and the reader is the only one who knows whether
 *   they are here to read the dashboard or the chat. So the width is theirs.
 *
 *   Two details that are easy to get wrong:
 *
 *   - **The iframe eats the drag.** Once the pointer crosses into the dashboard
 *     frame, the parent stops receiving pointermove and the divider sticks. The
 *     handle takes a pointer capture on pointerdown, which keeps every subsequent
 *     event on the handle regardless of what it is over.
 *   - **Bounds are not decoration.** Without a floor the reader can drag the pane
 *     over the composer and lose the chat with no way back; without a ceiling the
 *     chat becomes a column too narrow to read. Both are one drag from happening
 *     and neither is obvious to undo.
 */
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export const MIN_PANE = 320
export const MAX_PANE = 900
const DEFAULT_PANE = 500
const STORAGE_KEY = 'ochat:home-pane-width'

export function usePaneWidth() {
  // Starts at the default on both server and first client render — reading
  // localStorage during render would make the two disagree and hydrate wrong.
  const [width, setWidth] = useState(DEFAULT_PANE)
  // Two flags for one state, deliberately. `draggingRef` is the gate the move
  // handler reads: a React state update is not visible until the next render, so
  // a pointermove arriving in the same tick as the pointerdown would be dropped —
  // the drag appears to stick for a frame before catching up. The ref is correct
  // immediately. `dragging` state exists only to drive the visual class.
  const draggingRef = useRef(false)
  const [dragging, setDragging] = useState(false)
  const startRef = useRef({ x: 0, w: DEFAULT_PANE })

  useEffect(() => {
    const saved = Number(window.localStorage.getItem(STORAGE_KEY))
    if (saved >= MIN_PANE && saved <= MAX_PANE) setWidth(saved)
  }, [])

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLElement>) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    startRef.current = { x: e.clientX, w: width }
    draggingRef.current = true
    setDragging(true)
  }, [width])

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (!draggingRef.current) return
    // The pane is on the right, so dragging left widens it.
    const next = startRef.current.w - (e.clientX - startRef.current.x)
    setWidth(Math.min(MAX_PANE, Math.max(MIN_PANE, next)))
  }, [])

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (!draggingRef.current) return
    draggingRef.current = false
    e.currentTarget.releasePointerCapture(e.pointerId)
    setDragging(false)
    setWidth((w) => { window.localStorage.setItem(STORAGE_KEY, String(w)); return w })
  }, [])

  // Keyboard users get the same control; a divider nobody can reach without a
  // mouse is a control only some readers have.
  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLElement>) => {
    const step = e.shiftKey ? 50 : 10
    const delta = e.key === 'ArrowLeft' ? step : e.key === 'ArrowRight' ? -step : 0
    if (!delta) return
    e.preventDefault()
    setWidth((w) => {
      const next = Math.min(MAX_PANE, Math.max(MIN_PANE, w + delta))
      window.localStorage.setItem(STORAGE_KEY, String(next))
      return next
    })
  }, [])

  return { width, dragging, onPointerDown, onPointerMove, onPointerUp, onKeyDown }
}
