/* eslint-disable @typescript-eslint/no-unused-expressions */
(args) => {
  const provider = String(args.provider ?? '').trim()
  const expected = String(args.option ?? '').trim()
  const dialog = document.querySelector('[role="dialog"]')
  const menu = dialog?.querySelector(`[role="menu"][aria-label="${provider} permission profiles"]`)
  if (!(menu instanceof HTMLElement)) {
    return { ok: false, error: `${provider} permission menu not found` }
  }

  const option = [...menu.querySelectorAll('[role="menuitemradio"]')].find((candidate) =>
    candidate.querySelector('span.min-w-0 > span')?.textContent?.trim() === expected,
  )
  if (!(option instanceof HTMLButtonElement)) {
    return { ok: false, error: `provider permission option not found: ${expected}` }
  }
  if (option.disabled) {
    return { ok: false, error: `provider permission option is disabled: ${expected}` }
  }
  option.click()
  return { ok: true, provider, option: expected }
}
