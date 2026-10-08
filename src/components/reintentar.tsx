'use client'

import { RotateCcw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'

export function BotonReintentar({ onReintentar }: { onReintentar?: () => void }) {
  const router = useRouter()
  const [pendiente, empezar] = useTransition()
  return (
    <button
      type="button"
      disabled={pendiente}
      onClick={() =>
        empezar(() => {
          onReintentar?.()
          router.refresh()
        })
      }
      className="tocable inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm font-medium hover:bg-surface-2 disabled:opacity-60"
    >
      <RotateCcw aria-hidden className={`size-4 ${pendiente ? 'animate-spin' : ''}`} />
      {pendiente ? 'Reintentando…' : 'Reintentar'}
    </button>
  )
}
