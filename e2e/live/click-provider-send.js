(args) => {
  const provider = String(args.provider ?? '').trim()
  const dialog = document.querySelector('[role="dialog"]')
  const button = dialog?.querySelector(`[aria-label="Send message to ${provider}"]`)
  if (!(button instanceof HTMLButtonElement)) {
    return { ok: false, error: `${provider || 'provider'} send button not found` }
  }
  if (button.disabled) {
    return { ok: false, error: `${provider || 'provider'} send button is disabled` }
  }
  button.click()
  return { ok: true, provider }
}
