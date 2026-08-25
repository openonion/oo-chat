/* eslint-disable @typescript-eslint/no-unused-expressions */
() => {
  const denial = () => Promise.reject(new DOMException('Permission denied', 'NotAllowedError'))
  const current = navigator.mediaDevices
  if (current) {
    Object.defineProperty(current, 'getUserMedia', {
      configurable: true,
      value: denial,
    })
  } else {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: denial },
    })
  }
  return { ok: true, microphone: 'denied-by-release-gate' }
}
