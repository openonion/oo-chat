import { HiOutlineExclamationCircle, HiOutlineX } from 'react-icons/hi'

interface ChatErrorProps {
  error: string
  onRetry?: () => void
  onDismiss?: () => void
}

export function ChatError({ error, onRetry, onDismiss }: ChatErrorProps) {
  const getErrorMessage = (error: string) => {
    if (error.includes('timeout')) return 'Connection timed out'
    if (error.includes('closed')) return 'Connection lost'
    if (error.includes('health check')) return 'Connection interrupted'
    return `Error: ${error}`
  }

  return (
    <div className="mb-2 flex items-center justify-between gap-2 rounded-lg bg-red-50 px-4 py-2 border border-red-200">
      <div className="flex items-center gap-2 flex-1">
        <HiOutlineExclamationCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
        <span className="text-sm text-red-600">
          {getErrorMessage(error)}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {onRetry && (
          <button
            onClick={onRetry}
            className="text-sm font-medium text-red-600 hover:text-red-700"
          >
            Retry
          </button>
        )}
        {onDismiss && (
          <button onClick={onDismiss} className="text-red-400 hover:text-red-600">
            <HiOutlineX className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )
}
