/* eslint-disable @typescript-eslint/no-unused-expressions */
(args) => {
  const provider = String(args.provider ?? '').trim().toLocaleLowerCase()
  const cards = [...document.querySelectorAll('section[aria-label]')]
  const card = cards.find((candidate) => {
    const label = candidate.getAttribute('aria-label')?.toLocaleLowerCase() ?? ''
    return label.startsWith(provider)
  })
  const button = card?.querySelector('button[aria-label="Open Work Room"]')
  if (!(button instanceof HTMLButtonElement)) {
    return { ok: false, error: `${provider || 'provider'} Workroom card not found` }
  }
  button.click()
  return { ok: true, provider }
}
