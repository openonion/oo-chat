/* eslint-disable @typescript-eslint/no-unused-expressions */
(args) => {
  const provider = String(args.provider ?? '').trim()
  const prompt = String(args.prompt ?? '')
  const dialog = document.querySelector('[role="dialog"]')
  const composer = dialog?.querySelector(`[aria-label="Message ${provider} directly"]`)
  if (!(composer instanceof HTMLTextAreaElement)) {
    return { ok: false, error: `${provider || 'provider'} composer not found` }
  }
  if (composer.disabled || !prompt.trim()) {
    return { ok: false, error: `${provider || 'provider'} composer is unavailable` }
  }
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
  setter?.call(composer, prompt)
  // Match React's controlled-input path used by the component acceptance
  // tests. A generic input event is more portable than constructing an
  // InputEvent with synthetic insertion metadata in browser automation.
  composer.dispatchEvent(new Event('input', { bubbles: true }))
  composer.dispatchEvent(new Event('change', { bubbles: true }))
  composer.focus()
  return { ok: true, provider, characters: prompt.length }
}
