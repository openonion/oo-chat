'use client'

import { useState, useRef, useEffect } from 'react'
import { HiOutlineShieldCheck, HiOutlineClipboardList, HiOutlineLightningBolt, HiOutlineChevronDown, HiX } from 'react-icons/hi'
import { HiOutlineRocketLaunch } from 'react-icons/hi2'
import type { ApprovalMode } from './types'

interface ModeSwitcherProps {
  mode: ApprovalMode
  onModeChange: (mode: ApprovalMode, options?: { turns?: number }) => void
  disabled?: boolean
  ulwTurnsRemaining?: number | null
}

// Base modes only - ULW is a separate toggle
const BASE_MODES: ApprovalMode[] = ['safe', 'plan', 'accept_edits']

// Modes are differentiated by weight/fill, not hue. Red is reserved for ULW (dangerous).
const MODE_CONFIG: Record<ApprovalMode, { icon: React.ElementType; label: string; description: string; color: string }> = {
  safe: {
    icon: HiOutlineShieldCheck,
    label: 'Safe',
    description: 'Ask before file edits & commands',
    color: 'text-neutral-500',
  },
  plan: {
    icon: HiOutlineClipboardList,
    label: 'Plan',
    description: 'Research first, then approve plan',
    color: 'text-neutral-500',
  },
  accept_edits: {
    icon: HiOutlineLightningBolt,
    label: 'Accept Edits',
    description: 'Trust agent to edit without asking',
    color: 'text-neutral-500',
  },
  ulw: {
    icon: HiOutlineRocketLaunch,
    label: 'Ultra Work',
    description: 'Work autonomously for N turns',
    color: 'text-red-600',
  },
}

export function ModeSwitcher({ mode, onModeChange, disabled, ulwTurnsRemaining }: ModeSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const isUlwActive = mode === 'ulw'
  const displayMode = isUlwActive ? 'safe' : mode

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const currentMode = MODE_CONFIG[displayMode] || MODE_CONFIG.safe
  const Icon = currentMode.icon

  return (
    <div className="flex items-center gap-2">
      {/* Mode dropdown - disabled when ULW is active */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => !disabled && !isUlwActive && setIsOpen(!isOpen)}
          disabled={disabled || isUlwActive}
          className={`
            flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium
            bg-neutral-100
            hover:bg-neutral-200
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors
          `}
        >
          <Icon className={`w-4 h-4 ${currentMode.color}`} />
          <span className="text-neutral-700">{currentMode.label}</span>
          {!isUlwActive && (
            <HiOutlineChevronDown className={`w-3.5 h-3.5 text-neutral-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          )}
        </button>

        {isOpen && !isUlwActive && (
          <div className="absolute right-0 mt-1 w-64 py-1 bg-white rounded-lg shadow-lg border border-neutral-200 z-50">
            {BASE_MODES.map((key) => {
              const config = MODE_CONFIG[key]
              const ModeIcon = config.icon
              const isActive = mode === key
              return (
                <button
                  key={key}
                  onClick={() => {
                    onModeChange(key)
                    setIsOpen(false)
                  }}
                  className={`
                    w-full px-3 py-2 flex items-start gap-3 text-left
                    hover:bg-neutral-100
                    ${isActive ? 'bg-neutral-50' : ''}
                    transition-colors
                  `}
                >
                  <ModeIcon className={`w-5 h-5 mt-0.5 ${isActive ? 'text-neutral-900' : 'text-neutral-500'}`} />
                  <div className="flex-1 min-w-0">
                    <div className={`${isActive ? 'font-semibold' : 'font-medium'} text-neutral-900`}>
                      {config.label}
                    </div>
                    <div className="text-xs text-neutral-500">
                      {config.description}
                    </div>
                  </div>
                  {isActive && (
                    <div className="w-2 h-2 rounded-full mt-1.5 bg-neutral-900" />
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* ULW Toggle - separate from mode dropdown */}
      {isUlwActive ? (
        <button
          onClick={() => onModeChange('safe')}
          disabled={disabled}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium
            bg-red-50 border border-red-200
            text-red-600
            hover:bg-red-100
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors"
          title="Click to stop ultra work mode"
        >
          <HiOutlineRocketLaunch className="w-4 h-4" />
          <span className="font-semibold">{ulwTurnsRemaining ?? '?'} left</span>
          <HiX className="w-3.5 h-3.5 opacity-60 hover:opacity-100" />
        </button>
      ) : (
        <button
          onClick={() => onModeChange('ulw', { turns: 100 })}
          disabled={disabled}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm
            text-neutral-500
            hover:text-neutral-900
            hover:bg-neutral-100
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors"
          title="Enable ultra work mode - agent works autonomously for 100 turns"
        >
          <HiOutlineRocketLaunch className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}

/** Banner shown when in Plan Mode */
export function PlanModeBanner({ onExit }: { onExit?: () => void }) {
  return (
    <div className="flex items-center justify-between px-4 py-2 bg-neutral-50 border-b border-neutral-200">
      <div className="flex items-center gap-2">
        <HiOutlineClipboardList className="w-4 h-4 text-neutral-600" />
        <span className="text-sm text-neutral-700">
          Plan Mode Active — Agent is researching before acting
        </span>
      </div>
      {onExit && (
        <button
          onClick={onExit}
          className="text-xs text-neutral-600 hover:text-neutral-900"
        >
          Exit Plan Mode
        </button>
      )}
    </div>
  )
}

/** Banner shown when in Ultra Work Mode */
export function UlwModeBanner({ turnsRemaining, onExit }: { turnsRemaining?: number | null; onExit?: () => void }) {
  return (
    <div className="flex items-center justify-between px-4 py-2 bg-neutral-900">
      <div className="flex items-center gap-2">
        <HiOutlineRocketLaunch className="w-4 h-4 text-red-400" />
        <span className="text-sm font-medium text-white">Ultra Work Mode — fully autonomous</span>
        {turnsRemaining != null && (
          <span className="text-xs text-neutral-300">{turnsRemaining} turns remaining</span>
        )}
      </div>
      {onExit && (
        <button
          onClick={onExit}
          className="px-3 py-1 rounded text-xs font-medium text-white border border-neutral-600 hover:bg-neutral-800 transition-colors"
        >
          Stop
        </button>
      )}
    </div>
  )
}
