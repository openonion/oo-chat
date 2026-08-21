/* eslint-disable @typescript-eslint/no-unused-expressions */
() => {
  const isVisible = (element) =>
    element instanceof HTMLElement &&
    (element.offsetWidth > 0 || element.offsetHeight > 0 || element.getClientRects().length > 0)

  const stop = [...document.querySelectorAll('button')].find(
    (candidate) =>
      isVisible(candidate) &&
      !candidate.disabled &&
      candidate.getAttribute('aria-label')?.trim() === 'Stop agent',
  )
  const send = [...document.querySelectorAll('button')].find(
    (candidate) =>
      isVisible(candidate) &&
      candidate.getAttribute('aria-label')?.trim() === 'Send message',
  )
  const composer = document.querySelector(
    '[placeholder="Message this agent..."], [placeholder="Send a message..."]',
  )

  return {
    ok: true,
    running: Boolean(stop),
    sendReady: Boolean(send),
    composerPresent:
      (composer instanceof HTMLTextAreaElement || composer instanceof HTMLInputElement) &&
      !composer.disabled,
  }
}
