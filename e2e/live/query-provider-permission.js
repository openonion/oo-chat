/* eslint-disable @typescript-eslint/no-unused-expressions */
(args) => {
  const provider = String(args.provider ?? '').trim()
  const dialog = document.querySelector('[role="dialog"]')
  if (!(dialog instanceof HTMLElement)) {
    return { ok: false, error: 'Workroom dialog not found' }
  }

  const trigger = [...dialog.querySelectorAll('button')].find((candidate) =>
    candidate.getAttribute('aria-label')?.startsWith('Provider permissions: '),
  )
  if (!(trigger instanceof HTMLButtonElement)) {
    return { ok: false, error: `${provider} permission trigger not found` }
  }

  const outerModeTrigger = [...document.querySelectorAll('button')].find((candidate) =>
    candidate.getAttribute('aria-label')?.startsWith('Mode: '),
  )
  const menu = dialog.querySelector(`[role="menu"][aria-label="${provider} permission profiles"]`)
  const options = menu
    ? [...menu.querySelectorAll('[role="menuitemradio"]')].map((candidate) => {
        const label = candidate.querySelector('span.min-w-0 > span')?.textContent?.trim() ?? ''
        return {
          label,
          checked: candidate.getAttribute('aria-checked') === 'true',
          disabled: candidate instanceof HTMLButtonElement && candidate.disabled,
        }
      })
    : []

  return {
    ok: true,
    provider,
    activeLabel: trigger.getAttribute('aria-label')?.slice('Provider permissions: '.length) ?? '',
    triggerDisabled: trigger.disabled,
    menuOpen: trigger.getAttribute('aria-expanded') === 'true' && menu instanceof HTMLElement,
    options,
    outerMode: outerModeTrigger?.getAttribute('aria-label')?.slice('Mode: '.length) ?? '',
  }
}
