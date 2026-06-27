// In-memory set of sensitive values (credentials the user typed into the login
// modal) to mask wherever they would otherwise show in tool-call displays
// (e.g. keyboard_type(<password>), type_text_by_selector(..., <username>)).
// Not persisted — lives only for the session.

const secrets = new Set<string>()

export function addSecret(value: string): void {
  if (value && value.trim().length >= 3) secrets.add(value)
}

// Mask only when a tool-call argument IS exactly one of the entered credentials.
// Normal typing (any other text) never matches, so it is never masked.
export function redact(value: string): string {
  return secrets.has(value) ? '••••••' : value
}
