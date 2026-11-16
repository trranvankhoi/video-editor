import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronRight, Search, X } from 'lucide-react'
import { clamp } from '../lib/utils'

/* -------------------------------------------------------------------------- */
/* Buttons                                                                     */
/* -------------------------------------------------------------------------- */

export function IconButton({
  label,
  children,
  className = '',
  active = false,
  disabled = false,
  onClick,
  size,
  type = 'button',
}: {
  label: string
  children: ReactNode
  className?: string
  active?: boolean
  disabled?: boolean
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void
  size?: 'sm'
  type?: 'button' | 'submit'
}) {
  return (
    <button
      type={type}
      className={`btn-icon ${size === 'sm' ? 'sm' : ''} ${active ? 'active' : ''} ${className}`}
      title={label}
      aria-label={label}
      aria-pressed={active || undefined}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

/* -------------------------------------------------------------------------- */
/* Slider                                                                      */
/* -------------------------------------------------------------------------- */

export interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
  format?: (value: number) => string
  disabled?: boolean
  compact?: boolean
  action?: ReactNode
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
  disabled,
  compact,
  action,
}: SliderProps) {
  const percent = clamp(((value - min) / (max - min)) * 100, 0, 100)
  return (
    <div className="slider">
      <div className="slider-head">
        <span>{label}</span>
        <b>{format ? format(value) : value}</b>
        {action}
      </div>
      <div className="slider-body">
        <input
          type="range"
          className="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          style={{ '--fill': `${percent}%` } as CSSProperties}
          onChange={(event) => onChange(Number(event.target.value))}
          aria-label={label}
        />
        {!compact && (
          <input
            type="number"
            className="input mini"
            min={min}
            max={max}
            step={step}
            value={Number(value.toFixed(3))}
            disabled={disabled}
            onChange={(event) => {
              const next = Number(event.target.value)
              if (Number.isFinite(next)) onChange(clamp(next, min, max))
            }}
            aria-label={`${label} value`}
          />
        )}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Toggle                                                                      */
/* -------------------------------------------------------------------------- */

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      className="toggle"
      data-on={checked}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
    />
  )
}

/* -------------------------------------------------------------------------- */
/* Segmented                                                                   */
/* -------------------------------------------------------------------------- */

export interface SegmentedOption<T extends string> {
  value: T
  label: ReactNode
  title?: string
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className = '',
}: {
  value: T
  options: Array<SegmentedOption<T>>
  onChange: (value: T) => void
  className?: string
}) {
  return (
    <div className={`segmented ${className}`} role="group">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          data-active={option.value === value}
          title={option.title}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Color field                                                                 */
/* -------------------------------------------------------------------------- */

export function ColorField({
  value,
  onChange,
  label,
}: {
  value: string
  onChange: (value: string) => void
  label: string
}) {
  const safe = /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#ffffff'
  return (
    <div className="color-field">
      <input
        type="color"
        value={safe}
        aria-label={label}
        onChange={(event) => onChange(event.target.value)}
      />
      <input
        type="text"
        value={value}
        spellCheck={false}
        aria-label={`${label} hex value`}
        onChange={(event) => {
          const next = event.target.value
          onChange(next.startsWith('#') ? next : `#${next}`)
        }}
      />
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Section                                                                     */
/* -------------------------------------------------------------------------- */

export function Section({
  title,
  children,
  defaultOpen = true,
  action,
  icon,
}: {
  title: string
  children: ReactNode
  defaultOpen?: boolean
  action?: ReactNode
  icon?: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  const id = useId()
  return (
    <section className="section">
      <div className="section-head" data-open={open}>
        <button
          type="button"
          className="section-head"
          style={{ padding: 0, width: 'auto', flex: 1 }}
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((value) => !value)}
        >
          {icon}
          {title}
          <ChevronRight size={13} className="chevron" />
        </button>
        {action && <div className="section-action">{action}</div>}
      </div>
      {open && (
        <div className="section-body" id={id}>
          {children}
        </div>
      )}
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/* Modal                                                                       */
/* -------------------------------------------------------------------------- */

export function Modal({
  title,
  subtitle,
  icon,
  children,
  footer,
  onClose,
  size,
}: {
  title: string
  subtitle?: string
  icon?: ReactNode
  children: ReactNode
  footer?: ReactNode
  onClose: () => void
  size?: 'narrow' | 'wide'
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    ref.current?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div
      className="modal-backdrop"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        className={`modal ${size ?? ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={ref}
      >
        <header className="modal-head">
          {icon}
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <IconButton label="Close" onClick={onClose}>
            <X size={16} />
          </IconButton>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>,
    document.body,
  )
}

/* -------------------------------------------------------------------------- */
/* Search input                                                                */
/* -------------------------------------------------------------------------- */

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search',
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <div className="search-box">
      <Search size={13} />
      <input
        className="input"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        aria-label={placeholder}
      />
      {value && (
        <IconButton
          label="Clear search"
          size="sm"
          className="search-clear"
          onClick={() => onChange('')}
        >
          <X size={12} />
        </IconButton>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Misc                                                                        */
/* -------------------------------------------------------------------------- */

export function Kbd({ children }: { children: ReactNode }) {
  return <span className="kbd">{children}</span>
}

export function EmptyLibrary({
  icon,
  title,
  body,
  action,
}: {
  icon: ReactNode
  title: string
  body: string
  action?: ReactNode
}) {
  return (
    <div className="library-empty">
      <div className="circle">{icon}</div>
      <h4>{title}</h4>
      <p>{body}</p>
      {action}
    </div>
  )
}

export function ToggleRow({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  hint?: string
}) {
  return (
    <div className="toggle-row">
      <div>
        {label}
        {hint && <div className="hint">{hint}</div>}
      </div>
      <Toggle checked={checked} onChange={onChange} label={label} />
    </div>
  )
}

export function CheckMark({ show }: { show: boolean }) {
  if (!show) return null
  return <Check size={11} />
}
