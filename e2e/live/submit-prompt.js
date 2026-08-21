/* eslint-disable @typescript-eslint/no-unused-expressions */
(args) => {
  const field = document.querySelector(
    '[placeholder="Message this agent..."], [placeholder="Send a message..."]',
  )
  if (!(field instanceof HTMLTextAreaElement || field instanceof HTMLInputElement)) {
    return { ok: false, error: 'message composer not found' }
  }

  const prototype = field instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set
  if (!setter) return { ok: false, error: 'native value setter not found' }

  setter.call(field, String(args.prompt ?? ''))
  field.dispatchEvent(new Event('input', { bubbles: true }))
  field.focus()
  return { ok: true, characters: field.value.length }
}
