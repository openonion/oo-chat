'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  createBrowserIdentity,
  importBrowserIdentity,
  initializeBrowserIdentity,
  type BrowserIdentity,
} from '@connectonion/react'
import { useChatStore } from '@/store/chat-store'

async function authenticateWithOpenOnion(identity: BrowserIdentity): Promise<string> {
  const timestamp = Math.floor(Date.now() / 1000)
  const message = `ConnectOnion-Auth-${identity.address}-${timestamp}`
  const signature = await identity.sign(message)
  const response = await fetch('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ public_key: identity.address, signature, message }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Authentication failed' }))
    throw new Error(error.detail || 'Authentication failed')
  }
  return (await response.json()).token
}

async function getUserProfile(token: string) {
  const response = await fetch('/api/auth', {
    headers: { 'Authorization': `Bearer ${token}` },
  })
  if (!response.ok) throw new Error('Failed to fetch profile')
  return response.json()
}

export function useIdentity() {
  const { setApiKey, setUserProfile } = useChatStore()
  const [identity, setIdentity] = useState<BrowserIdentity | null>(null)
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [showRecoveryPhrase, setShowRecoveryPhrase] = useState(false)
  const [newMnemonic, setNewMnemonic] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    initializeBrowserIdentity().then(initialized => {
      if (!active) return
      setIdentity(initialized.identity)
      if (initialized.recovery) {
        setNewMnemonic(initialized.recovery.value)
        setShowRecoveryPhrase(true)
      }
    }).catch(error => {
      if (active) setAuthError(error instanceof Error ? error.message : 'Identity unavailable')
    })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!identity) return
    const authenticate = async () => {
      setAuthLoading(true)
      setAuthError(null)
      const token = await authenticateWithOpenOnion(identity)
      setApiKey(token)
      setUserProfile(await getUserProfile(token))
      setAuthLoading(false)
    }
    authenticate().catch(error => {
      setAuthError(error instanceof Error ? error.message : 'Authentication failed')
      setApiKey('')
      setUserProfile(null)
      setAuthLoading(false)
    })
  }, [identity, setApiKey, setUserProfile])

  const generateNewIdentity = useCallback(async () => {
    if (!window.confirm('This will generate a new identity. Make sure you have backed up your current recovery phrase! Continue?')) return
    const created = await createBrowserIdentity()
    setApiKey('')
    setUserProfile(null)
    setIdentity(created.identity)
    setNewMnemonic(created.recovery?.value ?? null)
    setShowRecoveryPhrase(Boolean(created.recovery))
  }, [setApiKey, setUserProfile])

  const importKey = useCallback(async (input: string) => {
    if (!input.trim()) return false
    try {
      const imported = await importBrowserIdentity(input)
      setApiKey('')
      setUserProfile(null)
      setIdentity(imported.identity)
      setNewMnemonic(null)
      setShowRecoveryPhrase(false)
      return true
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Invalid recovery material')
      return false
    }
  }, [setApiKey, setUserProfile])

  const exportKey = useCallback(() => {
    if (newMnemonic) setShowRecoveryPhrase(true)
    else alert('For security, the recovery phrase is shown only when an identity is created or migrated.')
  }, [newMnemonic])

  const dismissRecoveryPhrase = useCallback(() => {
    setShowRecoveryPhrase(false)
    setNewMnemonic(null)
  }, [])

  return {
    identity,
    authLoading,
    authError,
    showRecoveryPhrase,
    newMnemonic,
    generateNewIdentity,
    importKey,
    exportKey,
    dismissRecoveryPhrase,
  }
}
