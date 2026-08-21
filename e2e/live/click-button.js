/* eslint-disable @typescript-eslint/no-unused-expressions */
(args) => {
  const expected = String(args.text ?? '').trim()
  const button = [...document.querySelectorAll('button')].find(
    (candidate) =>
      candidate.textContent?.trim() === expected ||
      candidate.getAttribute('aria-label')?.trim() === expected,
  )
  if (!(button instanceof HTMLButtonElement)) {
    return { ok: false, error: `button not found: ${expected}` }
  }
  button.click()
  return { ok: true, text: expected }
}
