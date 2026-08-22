/* eslint-disable @typescript-eslint/no-unused-expressions */
(args) => {
  const url = String(args.url ?? '')
  if (!/^https?:\/\//.test(url)) return { ok: false, error: 'absolute http(s) URL required' }
  setTimeout(() => window.location.assign(url), 0)
  return { ok: true, navigating: true }
}
