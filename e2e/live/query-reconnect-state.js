/* eslint-disable @typescript-eslint/no-unused-expressions */
(args) => {
  const isVisible = (element) =>
    element instanceof HTMLElement &&
    (element.offsetWidth > 0 || element.offsetHeight > 0 || element.getClientRects().length > 0)
  const buttons = [...document.querySelectorAll('button')].filter(isVisible)
  const activeSurface = document.querySelector('[role="dialog"][aria-modal="true"]') || document
  const composerControls = [...activeSurface.querySelectorAll('textarea, button[aria-label^="Mode:"]')].filter(isVisible)
  const composerWithinViewport = composerControls.every(element => {
    const rect = element.getBoundingClientRect()
    return rect.top >= -1 && rect.bottom <= innerHeight + 1
  })
  const body = document.body.innerText
  const marker = String(args.promptMarker ?? '')

  return {
    ok: true,
    composerWithinViewport,
    reconnectVisible: buttons.some(button => button.textContent?.trim().toLowerCase() === 'reconnect'),
    retryVisible: buttons.some(button => button.textContent?.trim().toLowerCase() === 'retry'),
    connected: [...document.querySelectorAll('span, p, div')].some(
      element => isVisible(element) && element.textContent?.trim().toLowerCase() === 'connected',
    ),
    promptOccurrences: marker ? body.split(marker).length - 1 : 0,
    viewportWidth: document.documentElement.clientWidth,
    horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  }
}
