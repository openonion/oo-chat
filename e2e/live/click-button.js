/* eslint-disable @typescript-eslint/no-unused-expressions */
(args) => {
  const expected = String(args.text ?? '').trim()
  const normalizedExpected = expected.toLocaleLowerCase()
  const button = [...document.querySelectorAll('button')].find(
    (candidate) => {
      const text = candidate.textContent?.trim().toLocaleLowerCase()
      const ariaLabel = candidate.getAttribute('aria-label')?.trim().toLocaleLowerCase()
      return text === normalizedExpected || ariaLabel === normalizedExpected
    },
  )
  if (!(button instanceof HTMLButtonElement)) {
    return { ok: false, error: `button not found: ${expected}` }
  }
  button.click()
  return { ok: true, text: expected }
}
