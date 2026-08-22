/* eslint-disable @typescript-eslint/no-unused-expressions */
(args) => {
  const provider = String(args.provider ?? '').trim()
  const dialog = document.querySelector('[role="dialog"]')
  if (!(dialog instanceof HTMLElement)) {
    return { ok: false, error: 'Workroom dialog not found' }
  }
  const conversation = dialog.querySelector(`[aria-label="${provider} conversation"]`)
  const composer = dialog.querySelector(`[aria-label="Message ${provider} directly"]`)
  const status = dialog.querySelector('[aria-label="Current provider status"]')
  const statusText = status?.textContent ?? ''
  const visible = (element) =>
    element instanceof HTMLElement &&
    (element.offsetWidth > 0 || element.offsetHeight > 0 || element.getClientRects().length > 0)
  return {
    ok: true,
    provider,
    conversationPresent: visible(conversation),
    composerPresent: visible(composer),
    composerEnabled: composer instanceof HTMLTextAreaElement && !composer.disabled,
    currentStatusPresent: visible(status),
    statusHasRawNoise: /private reasoning|raw command|--dangerously-bypass|approval-policy/i.test(statusText),
    messageCount: conversation?.querySelectorAll('li').length ?? 0,
    visibleUserMessageCount: conversation?.querySelectorAll('[data-provider-message-role="user"]').length ?? 0,
    visibleAssistantMessageCount: conversation?.querySelectorAll('[data-provider-message-role="assistant"]').length ?? 0,
  }
}
