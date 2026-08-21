import { HiOutlineExclamationCircle, HiOutlineX } from 'react-icons/hi'

interface ChatErrorProps {
  error: string
  onRetry?: () => void
  onReconnect?: () => void
  onDismiss?: () => void
}

export function isReconnectError(error: string): boolean {
  const message = error.toLowerCase()
  return message.includes('reconnect')
    || message.includes('connection')
    || message.includes('disconnected')
    || message.includes('socket')
    || message.includes('closed')
    || message.includes('health check')
}

export function ChatError({ error, onRetry, onReconnect, onDismiss }: ChatErrorProps) {
  const reconnect = isReconnectError(error)
  const action = reconnect ? onReconnect : onRetry
  const getErrorMessage = (error: string) => {
    if (error.includes('timeout')) return 'Connection timed out'
    if (error.includes('closed')) return 'Connection lost'
    if (error.includes('health check')) return 'Connection interrupted'
    return `Error: ${error}`
  }

  return (
    // role="alert" so a failure interrupts rather than waiting its turn — the
    // reader is otherwise left waiting on a run that has already stopped.
    <div role="alert" className="mb-2 flex items-center justify-between gap-2 rounded-lg bg-red-50 px-4 py-2 border border-red-200">
      <div className="flex items-center gap-2 flex-1">
        <HiOutlineExclamationCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
        <span className="text-sm text-red-600">
          {getErrorMessage(error)}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {action && (
          <button
            onClick={action}
            className="min-h-11 px-2 text-sm font-medium text-red-600 hover:text-red-700"
          >
            {reconnect ? 'Reconnect' : 'Retry'}
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
