'use client'

import { useState, useEffect, useCallback } from 'react'
import nacl from 'tweetnacl'
import * as bip39 from 'bip39'
import { useChatStore } from '@/store/chat-store'

export interface AddressData {
  address: string
  shortAddress: string
  publicKey: Uint8Array
  privateKey: Uint8Array
  mnemonic?: string
}

function generateWithMnemonic(): { keys: AddressData; mnemonic: string } {
  const mnemonic = bip39.generateMnemonic()
  const keys = keysFromMnemonic(mnemonic)
  return { keys: { ...keys, mnemonic }, mnemonic }
}

function keysFromMnemonic(mnemonic: string): AddressData {
  const seed = bip39.mnemonicToSeedSync(mnemonic).slice(0, 32)
  const keyPair = nacl.sign.keyPair.fromSeed(seed)
  const address = '0x' + Array.from(keyPair.publicKey).map(b => b.toString(16).padStart(2, '0')).join('')
  const shortAddress = `${address.slice(0, 6)}...${address.slice(-4)}`
  return { address, shortAddress, publicKey: keyPair.publicKey, privateKey: keyPair.secretKey }
}

function saveBrowser(keys: AddressData, mnemonic?: string): void {
  if (typeof window === 'undefined') return
  const data = {
    address: keys.address,
    shortAddress: keys.shortAddress,
    publicKey: Array.from(keys.publicKey).map(b => b.toString(16).padStart(2, '0')).join(''),
    privateKey: Array.from(keys.privateKey).map(b => b.toString(16).padStart(2, '0')).join(''),
    mnemonic,
  }
  window.localStorage.setItem('connectonion_keys', JSON.stringify(data))
}

function loadBrowser(): AddressData | null {
  if (typeof window === 'undefined') return null
  const stored = window.localStorage.getItem('connectonion_keys')
  if (!stored) return null
  const data = JSON.parse(stored)
  return {
    address: data.address,
    shortAddress: data.shortAddress,
    publicKey: new Uint8Array(data.publicKey.match(/.{2}/g)!.map((b: string) => parseInt(b, 16))),
    privateKey: new Uint8Array(data.privateKey.match(/.{2}/g)!.map((b: string) => parseInt(b, 16))),
    mnemonic: data.mnemonic,
  }
}

function signMessage(keys: AddressData, message: string): string {
  const msgBytes = new TextEncoder().encode(message)
  const signature = nacl.sign.detached(msgBytes, keys.privateKey)
  return Array.from(signature).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function authenticateWithOpenOnion(keys: AddressData): Promise<string> {
  const timestamp = Math.floor(Date.now() / 1000)
  const message = `ConnectOnion-Auth-${keys.address}-${timestamp}`
  const signature = signMessage(keys, message)

  const response = await fetch('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      public_key: keys.address,
      signature,
      message,
    }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Authentication failed' }))
    throw new Error(error.detail || 'Authentication failed')
  }

  const data = await response.json()
  return data.token
}

async function getUserProfile(token: string) {
  const response = await fetch('/api/auth', {
    headers: { 'Authorization': `Bearer ${token}` },
  })

  if (!response.ok) {
    throw new Error('Failed to fetch profile')
  }

  return response.json()
}

export function useIdentity() {
  const { setApiKey, setUserProfile } = useChatStore()

  const [identity, setIdentity] = useState<AddressData | null>(null)
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [showRecoveryPhrase, setShowRecoveryPhrase] = useState(false)
  const [newMnemonic, setNewMnemonic] = useState<string | null>(null)

  // Load identity on mount
  useEffect(() => {
    const keys = loadBrowser()
    if (keys) {
      setIdentity(keys)
    } else {
      const { keys: newKeys, mnemonic } = generateWithMnemonic()
      saveBrowser(newKeys, mnemonic)
      setIdentity(newKeys)
      setNewMnemonic(mnemonic)
      setShowRecoveryPhrase(true)
    }
  }, [])

  // Authenticate when identity changes
  useEffect(() => {
    if (!identity) return

    const authenticate = async () => {
      setAuthLoading(true)
      setAuthError(null)
      const token = await authenticateWithOpenOnion(identity)
      setApiKey(token)
      const profile = await getUserProfile(token)
      setUserProfile(profile)
      setAuthLoading(false)
    }

    authenticate().catch(err => {
      setAuthError(err instanceof Error ? err.message : 'Authentication failed')
      setApiKey('')
      setUserProfile(null)
      setAuthLoading(false)
    })
  }, [identity, setApiKey, setUserProfile])

  const generateNewIdentity = useCallback(() => {
    if (!window.confirm('This will generate a new identity. Make sure you have backed up your current recovery phrase! Continue?')) return
    const { keys: newKeys, mnemonic } = generateWithMnemonic()
    saveBrowser(newKeys, mnemonic)
    setApiKey('')
    setUserProfile(null)
    setIdentity(newKeys)
    setNewMnemonic(mnemonic)
    setShowRecoveryPhrase(true)
  }, [setApiKey, setUserProfile])

  const importKey = useCallback((input: string) => {
    const trimmed = input.trim().toLowerCase()
    if (!trimmed) return false

    const words = trimmed.split(/\s+/)
    if (words.length === 12 || words.length === 24) {
      if (!bip39.validateMnemonic(trimmed)) {
        alert('Invalid recovery phrase. Please check your words and try again.')
        return false
      }

      const keys = keysFromMnemonic(trimmed)
      saveBrowser(keys, trimmed)
      setApiKey('')
      setUserProfile(null)
      setIdentity(keys)
      return true
    }

    const keyHex = trimmed.startsWith('0x') ? trimmed.slice(2) : trimmed
    if (keyHex.length !== 128) {
      alert('Invalid format. Enter a 12-word recovery phrase.')
      return false
    }

    const privateKey = new Uint8Array(keyHex.match(/.{2}/g)!.map((b: string) => parseInt(b, 16)))
    const publicKey = privateKey.slice(32)
    const address = '0x' + Array.from(publicKey).map(b => b.toString(16).padStart(2, '0')).join('')
    const shortAddress = `${address.slice(0, 6)}...${address.slice(-4)}`

    const keys: AddressData = { address, shortAddress, publicKey, privateKey }
    saveBrowser(keys)
    setApiKey('')
    setUserProfile(null)
    setIdentity(keys)
    return true
  }, [setApiKey, setUserProfile])

  const exportKey = useCallback(() => {
    if (!identity) return
    if (identity.mnemonic) {
      setNewMnemonic(identity.mnemonic)
      setShowRecoveryPhrase(true)
    } else {
      const privateKeyHex = Array.from(identity.privateKey).map(b => b.toString(16).padStart(2, '0')).join('')
      navigator.clipboard.writeText(privateKeyHex)
      alert('Private key copied (legacy format). Consider generating a new identity for mnemonic recovery.')
    }
  }, [identity])

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
