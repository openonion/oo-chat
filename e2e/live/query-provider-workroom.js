/* eslint-disable @typescript-eslint/no-unused-expressions */
(args) => {
  const provider = String(args.provider ?? '').trim()
  const marker = String(args.marker ?? '')
  const dialog = document.querySelector('[role="dialog"]')
  if (!(dialog instanceof HTMLElement)) {
    return { ok: false, error: 'Workroom dialog not found' }
  }
  const conversation = dialog.querySelector(`[aria-label="${provider} conversation"]`)
  const composer = dialog.querySelector(`[aria-label="Message ${provider} directly"]`)
  const voiceControl = dialog.querySelector(`[aria-label="Start ${provider} voice input"]`)
  const status = dialog.querySelector('[aria-label="Current provider status"]')
  const stopAction = provider.toLocaleLowerCase() === 'codex' ? 'Pause' : 'Stop'
  const stopControl = dialog.querySelector(`[aria-label="${stopAction} ${provider} run"]`)
  const alerts = [...dialog.querySelectorAll('[role="alert"]')]
    .map(element => element.textContent ?? '')
    .join(' ')
  const statusText = status?.textContent ?? ''
  const conversationText = conversation?.textContent ?? ''
  const visible = (element) =>
    element instanceof HTMLElement &&
    (element.offsetWidth > 0 || element.offsetHeight > 0 || element.getClientRects().length > 0)
  return {
    ok: true,
    provider,
    conversationPresent: visible(conversation),
    composerPresent: visible(composer),
    composerEnabled: composer instanceof HTMLTextAreaElement && !composer.disabled,
    composerValue: composer instanceof HTMLTextAreaElement ? composer.value : '',
    voiceControlPresent: visible(voiceControl),
    voiceControlEnabled: voiceControl instanceof HTMLButtonElement && !voiceControl.disabled,
    voiceErrorActionable: /microphone.*browser settings/i.test(alerts),
    currentStatusPresent: visible(status),
    stopControlPresent: visible(stopControl),
    stopControlEnabled: stopControl instanceof HTMLButtonElement && !stopControl.disabled,
    stoppedStatePresent: new RegExp(`${provider} · Stopped|The provider stopped`, 'i')
      .test(dialog.textContent ?? ''),
    statusHasRawNoise: /private reasoning|raw command|--dangerously-bypass|approval-policy/i.test(statusText),
    messageCount: conversation?.querySelectorAll('li').length ?? 0,
    visibleUserMessageCount: conversation?.querySelectorAll('[data-provider-message-role="user"]').length ?? 0,
    visibleAssistantMessageCount: conversation?.querySelectorAll('[data-provider-message-role="assistant"]').length ?? 0,
    markerOccurrences: marker ? conversationText.split(marker).length - 1 : 0,
  }
}
