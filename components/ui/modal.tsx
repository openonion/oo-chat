'use client'

import { useEffect, useRef } from 'react'
import { HiOutlineX } from 'react-icons/hi'
import { cn } from '@/components/chat/utils'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  className?: string
  maxWidth?: string
}

export function Modal({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  className,
  maxWidth = 'max-w-5xl'
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    if (!isOpen) return

    // Keyboard focus has to come with the dialog and go back where it was. Without
    // this, Tab from an "open" button walks the page behind the overlay instead of
    // the dialog, and closing leaves focus on nothing.
    const previouslyFocused = document.activeElement as HTMLElement | null
    closeRef.current?.focus()

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleEscape)

    return () => {
      document.body.style.overflow = 'unset'
      window.removeEventListener('keydown', handleEscape)
      previouslyFocused?.focus()
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 md:p-12">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-neutral-900/40 backdrop-blur-sm transition-opacity animate-in fade-in duration-300" 
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div 
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={cn(
          "relative w-full h-full flex flex-col bg-[#1e1e1e] rounded-2xl border border-neutral-800 shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-300",
          maxWidth,
          className
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-[#252526]">
          <h3 id="modal-title" className="text-base font-bold text-neutral-100 truncate">
            {title || 'Preview'}
          </h3>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Close"
            className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-xl transition-all"
          >
            <HiOutlineX className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </div>
    </div>
  )
}
