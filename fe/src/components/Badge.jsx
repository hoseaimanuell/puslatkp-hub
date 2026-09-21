/**
 * components/Badge.jsx
 * Reusable badge component dengan 5 variasi visual
 */

export default function Badge({ variant = 'neutral', children, className = '' }) {
  const classes = {
    success: 'badge-success',
    danger: 'badge-danger',
    warning: 'badge-warning',
    neutral: 'badge-neutral',
    draft: 'badge-draft',
    blue: 'badge-blue',
  }

  return (
    <span className={`${classes[variant] || classes.neutral} ${className}`}>
      {children}
    </span>
  )
}
