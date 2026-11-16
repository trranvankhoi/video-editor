import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import { useUI } from '../../store/ui'

export function Toasts() {
  const toasts = useUI((state) => state.toasts)
  const dismiss = useUI((state) => state.dismissToast)
  if (toasts.length === 0) return null
  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div className="toast" data-tone={toast.tone} key={toast.id}>
          {toast.tone === 'success' ? (
            <CheckCircle2 size={15} />
          ) : toast.tone === 'error' ? (
            <AlertTriangle size={15} />
          ) : (
            <Info size={15} />
          )}
          <span>{toast.message}</span>
          <button type="button" aria-label="Dismiss" onClick={() => dismiss(toast.id)}>
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  )
}
