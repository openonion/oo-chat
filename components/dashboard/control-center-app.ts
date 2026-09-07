/**
 * The authenticated, review-gated description of a full Web Control Center.
 *
 * Legacy DASHBOARD_SNAPSHOT HTML never becomes executable by claiming this shape
 * inside its own markup. Core/React must carry the descriptor outside the HTML,
 * over the authenticated Agent connection. O Chat validates it again at the
 * execution boundary before it creates an unsandboxed cross-origin iframe.
 */

export const CONTROL_CENTER_SCHEMA = 'connectonion.control-app/1' as const

export type ControlCenterCapability =
  | 'camera'
  | 'microphone'
  | 'geolocation'
  | 'clipboard-read'
  | 'clipboard-write'
  | 'fullscreen'

export type ControlCenterReview = {
  status: 'reviewing' | 'approved' | 'blocked'
  review_id?: string
  reviewed_at?: string
}

export interface ControlCenterAppDescriptor {
  schema: typeof CONTROL_CENTER_SCHEMA
  revision: string
  url: string
  sdk_version: '1'
  review: ControlCenterReview
  capabilities?: ControlCenterCapability[]
}

export type ControlCenterConversationTarget = 'current' | 'new'

export type ControlCenterActionResult = {
  sessionId: string
}

const REVISION = /^sha256:[a-f0-9]{64}$/
const CAPABILITIES = new Set<ControlCenterCapability>([
  'camera',
  'microphone',
  'geolocation',
  'clipboard-read',
  'clipboard-write',
  'fullscreen',
])

export type ValidatedControlCenterApp = ControlCenterAppDescriptor & {
  origin: string
}

/**
 * Full Web apps are intentionally not sandboxed: frameworks, storage, Workers,
 * routing and browser APIs need a normal document. The hard boundary is instead
 * a distinct HTTPS origin plus the narrow, versioned postMessage bridge.
 */
export function validateControlCenterApp(
  value: unknown,
  parentOrigin: string,
): { app: ValidatedControlCenterApp | null; error: string | null } {
  if (!value || typeof value !== 'object') {
    return { app: null, error: 'The Agent did not provide a Control Center app descriptor.' }
  }
  const candidate = value as Partial<ControlCenterAppDescriptor>
  if (candidate.schema !== CONTROL_CENTER_SCHEMA) {
    return { app: null, error: 'This Control Center uses an unsupported app schema.' }
  }
  if (candidate.sdk_version !== '1') {
    return { app: null, error: 'This Control Center needs a newer app bridge.' }
  }
  if (typeof candidate.revision !== 'string' || !REVISION.test(candidate.revision)) {
    return { app: null, error: 'The Control Center revision is missing or invalid.' }
  }
  if (!candidate.review || !['reviewing', 'approved', 'blocked'].includes(candidate.review.status)) {
    return { app: null, error: 'The Control Center review state is missing or invalid.' }
  }
  if (typeof candidate.url !== 'string') {
    return { app: null, error: 'The Control Center URL is missing.' }
  }

  let url: URL
  try {
    url = new URL(candidate.url)
  } catch {
    return { app: null, error: 'The Control Center URL is invalid.' }
  }
  if (url.protocol !== 'https:') {
    return { app: null, error: 'A full Control Center must be served over HTTPS.' }
  }
  if (url.search || url.hash) {
    return {app:null,error:'The reviewed URL must identify an immutable file without query or fragment.'}
  }
  if (['openonion.ai','connectonion.com'].some(domain=>url.hostname===domain||url.hostname.endsWith('.'+domain))) {
    return {app:null,error:'A full Control Center must use a domain isolated from product and identity cookies.'}
  }
  if (url.username || url.password) {
    return { app: null, error: 'The Control Center URL must not contain credentials.' }
  }
  if (url.origin === parentOrigin) {
    return { app: null, error: 'A full Control Center must run on an origin separate from O Chat.' }
  }

  const capabilities = candidate.capabilities ?? []
  if (!Array.isArray(capabilities) || capabilities.some(item => !CAPABILITIES.has(item))) {
    return { app: null, error: 'The Control Center requests an unsupported browser capability.' }
  }

  return {
    app: {
      schema: CONTROL_CENTER_SCHEMA,
      revision: candidate.revision,
      url: url.href,
      origin: url.origin,
      sdk_version: '1',
      review: candidate.review,
      capabilities: [...new Set(capabilities)],
    },
    error: null,
  }
}

export function capabilityPolicy(capabilities: ControlCenterCapability[] = []): string {
  return capabilities.map(capability => `${capability} 'src'`).join('; ')
}
