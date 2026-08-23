/* eslint-disable @typescript-eslint/no-unused-expressions */
(args) => {
  const isVisible = (element) =>
    element instanceof HTMLElement &&
    (element.offsetWidth > 0 || element.offsetHeight > 0 || element.getClientRects().length > 0)

  const allowedActions = Array.isArray(args.allowedActions)
    ? args.allowedActions.map((action) => String(action).trim()).filter(Boolean)
    : []
  const approval = [...document.querySelectorAll('[aria-label="Approval required"]')]
    .find(isVisible)

  if (!(approval instanceof HTMLElement)) {
    return {
      ok: true,
      approvalPresent: false,
      action: '',
      actionAllowed: false,
      allowOncePresent: false,
    }
  }

  // The heading is the sanitized action summary supplied by Core. Do not read
  // or return raw tool arguments from the approval card.
  const action = approval.querySelector('h2')?.textContent?.trim() ?? ''
  const allowOnce = [...approval.querySelectorAll('button')].find(
    (candidate) =>
      isVisible(candidate) &&
      candidate.textContent?.trim() === 'Allow once',
  )

  return {
    ok: true,
    approvalPresent: true,
    action,
    actionAllowed: allowedActions.includes(action),
    allowOncePresent: allowOnce instanceof HTMLButtonElement && !allowOnce.disabled,
  }
}
