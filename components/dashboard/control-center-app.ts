/**
 * The authenticated, review-gated description of a full Web Control Center.
 *
 * Legacy DASHBOARD_SNAPSHOT HTML never becomes executable by claiming this shape
 * inside its own markup. Core/React must carry the descriptor outside the HTML,
 * over the authenticated Agent connection. O Chat validates it again at the
 * execution boundary before it creates an unsandboxed cross-origin iframe.
 */

export const CONTROL_CENTER_SCHEMA = 'connectonion.control-app/1' as const
export const CONTROL_CENTER_BRIDGE_VERSION = 1 as const

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

export type ControlCenterContext = {
  type: 'connectonion.control-center/context'
  version: typeof CONTROL_CENTER_BRIDGE_VERSION
  revision: string
  agent: { address: string; name?: string }
  conversation: { sessionId: string | null }
  skills: { name: string; description?: string }[]
  actions: {
    sendMessage: true
    runSkill: true
    conversationTargets: ControlCenterConversationTarget[]
  }
}

export type ControlCenterConnect = {
  type: 'connectonion.control-center/connect'
  version: typeof CONTROL_CENTER_BRIDGE_VERSION
  revision: string
}

export type ControlCenterRequest = {
  type: 'connectonion.control-center/request'
  version: typeof CONTROL_CENTER_BRIDGE_VERSION
  revision: string
  id: string
  action: 'send_message' | 'run_skill'
  payload: Record<string, unknown>
}

export type ControlCenterResponse = {
  type: 'connectonion.control-center/response'
  version: typeof CONTROL_CENTER_BRIDGE_VERSION
  revision: string
  id: string
  ok: boolean
  result?: ControlCenterActionResult
  error?: { code: string; message: string }
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

const REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/

export function parseControlCenterRequest(
  value: unknown,
  revision: string,
): { request: ControlCenterRequest | null; error: string | null; id: string | null } {
  if (!value || typeof value !== 'object') return { request: null, error: null, id: null }
  const candidate = value as Partial<ControlCenterRequest>
  if (candidate.type !== 'connectonion.control-center/request') {
    return { request: null, error: null, id: null }
  }
  const id = typeof candidate.id === 'string' && REQUEST_ID.test(candidate.id)
    ? candidate.id
    : null
  if (!id) return { request: null, error: 'The request id is invalid.', id: null }
  if (candidate.version !== CONTROL_CENTER_BRIDGE_VERSION) {
    return { request: null, error: 'The app bridge version is unsupported.', id }
  }
  if (candidate.revision !== revision) {
    return { request: null, error: 'The app revision is stale.', id }
  }
  if (candidate.action !== 'send_message' && candidate.action !== 'run_skill') {
    return { request: null, error: 'The requested action is unsupported.', id }
  }
  if (!candidate.payload || typeof candidate.payload !== 'object' || Array.isArray(candidate.payload)) {
    return { request: null, error: 'The action payload is invalid.', id }
  }
  return { request: candidate as ControlCenterRequest, error: null, id }
}

export function conversationTarget(value: unknown): ControlCenterConversationTarget | null {
  if (value === undefined || value === 'current') return 'current'
  return value === 'new' ? 'new' : null
}
