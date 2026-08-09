import type { UI } from './types'

/** A success completes only the gate immediately before it, not future gates. */
export function isOnboardGateCompleted(items: UI[], gateIndex: number): boolean {
  for (let index = gateIndex + 1; index < items.length; index++) {
    if (items[index].type === 'onboard_required') return false
    if (items[index].type === 'onboard_success') return true
  }
  return false
}
