'use client'

import { useState, useRef, useEffect } from 'react'
import { HiOutlineShieldCheck, HiOutlineClipboardList, HiOutlineLightningBolt, HiOutlineChevronDown } from 'react-icons/hi'
import { HiOutlineRocketLaunch } from 'react-icons/hi2'
import type { ApprovalMode } from './types'

interface ModeSwitcherProps {
  mode: ApprovalMode
  onModeChange: (mode: ApprovalMode) => void
  disabled?: boolean
}

const MODE_CONFIG: Record<ApprovalMode, { icon: React.ElementType; label: string; description: string; color: string }> = {
  safe: {
    icon: HiOutlineShieldCheck,
    label: 'Safe',
    description: 'Ask before file edits & commands',
    color: 'text-green-600 dark:text-green-400',
  },
  plan: {
    icon: HiOutlineClipboardList,
    label: 'Plan',
    description: 'Research first, then approve plan',
    color: 'text-purple-600 dark:text-purple-400',
  },
  accept_edits: {
    icon: HiOutlineLightningBolt,
    label: 'Accept Edits',
    description: 'Trust agent to edit without asking',
    color: 'text-amber-600 dark:text-amber-400',
  },
  ulw: {
    icon: HiOutlineRocketLaunch,
    label: 'Ultra Work',
    description: 'Work autonomously for N turns',
    color: 'text-blue-600 dark:text-blue-400',
  },
}

export function ModeSwitcher({ mode, onModeChange, disabled }: ModeSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

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

  const currentMode = MODE_CONFIG[mode] || MODE_CONFIG.safe
  const Icon = currentMode.icon

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium
          bg-neutral-100 dark:bg-neutral-800
          hover:bg-neutral-200 dark:hover:bg-neutral-700
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-colors
        `}
      >
        <Icon className={`w-4 h-4 ${currentMode.color}`} />
        <span className="text-neutral-700 dark:text-neutral-300">{currentMode.label}</span>
        <HiOutlineChevronDown className={`w-3.5 h-3.5 text-neutral-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1 w-64 py-1 bg-white dark:bg-neutral-800 rounded-lg shadow-lg border border-neutral-200 dark:border-neutral-700 z-50">
          {(Object.entries(MODE_CONFIG) as [ApprovalMode, typeof MODE_CONFIG['safe']][]).map(([key, config]) => {
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
                  hover:bg-neutral-100 dark:hover:bg-neutral-700
                  ${isActive ? 'bg-neutral-50 dark:bg-neutral-750' : ''}
                  transition-colors
                `}
              >
                <ModeIcon className={`w-5 h-5 mt-0.5 ${config.color}`} />
                <div className="flex-1 min-w-0">
                  <div className={`font-medium ${isActive ? config.color : 'text-neutral-900 dark:text-neutral-100'}`}>
                    {config.label}
                  </div>
                  <div className="text-xs text-neutral-500 dark:text-neutral-400">
                    {config.description}
                  </div>
                </div>
                {isActive && (
                  <div className={`w-2 h-2 rounded-full mt-1.5 ${config.color.replace('text-', 'bg-')}`} />
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** Banner shown when in Plan Mode */
export function PlanModeBanner({ onExit }: { onExit?: () => void }) {
  return (
    <div className="flex items-center justify-between px-4 py-2 bg-purple-50 dark:bg-purple-950/30 border-b border-purple-200 dark:border-purple-800">
      <div className="flex items-center gap-2">
        <HiOutlineClipboardList className="w-4 h-4 text-purple-600 dark:text-purple-400" />
        <span className="text-sm text-purple-700 dark:text-purple-300">
          Plan Mode Active — Agent is researching before acting
        </span>
      </div>
      {onExit && (
        <button
          onClick={onExit}
          className="text-xs text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-200"
        >
          Exit Plan Mode
        </button>
      )}
    </div>
  )
}
