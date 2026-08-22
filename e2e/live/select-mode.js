/* eslint-disable @typescript-eslint/no-unused-expressions */
(args) => {
  const expected = String(args.expected ?? '').trim()
  const trigger = [...document.querySelectorAll('button')].find((candidate) =>
    candidate.getAttribute('aria-label')?.startsWith('Mode: '),
  )
  if (!(trigger instanceof HTMLButtonElement)) {
    return { ok: false, error: 'mode trigger not found' }
  }
  const current = trigger.getAttribute('aria-label')?.slice('Mode: '.length) ?? ''
  const already = current === expected || current.startsWith(`${expected} ·`)
  if (!already && args.open !== false) trigger.click()
  return { ok: true, current, already }
}
