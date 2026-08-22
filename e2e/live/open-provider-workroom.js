/* eslint-disable @typescript-eslint/no-unused-expressions */
(args) => {
  const provider = String(args.provider ?? '').trim().toLocaleLowerCase()
  const regions = [...document.querySelectorAll('[role="region"]')]
  const card = regions.find((candidate) => {
    const label = candidate.getAttribute('aria-label')?.toLocaleLowerCase() ?? ''
    return label.startsWith(provider)
  })
  const button = card?.querySelector('button')
  if (!(button instanceof HTMLButtonElement) || !/open work room/i.test(button.textContent ?? '')) {
    return { ok: false, error: `${provider || 'provider'} Workroom card not found` }
  }
  button.click()
  return { ok: true, provider }
}
