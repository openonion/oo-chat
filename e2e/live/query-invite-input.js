/* eslint-disable @typescript-eslint/no-unused-expressions */
(args) => {
  const input = document.querySelector('#onboard-invite-code')
  const expectedLength = Number(args.expectedLength)
  if (!(input instanceof HTMLInputElement)) {
    return { ok: false, error: 'invite input not found' }
  }
  return {
    ok: input.value.length === expectedLength && expectedLength > 0,
    length: input.value.length,
    expectedLength,
  }
}
