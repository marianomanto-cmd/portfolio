export default function Cargando() {
  return (
    <div aria-busy="true" aria-live="polite" className="flex flex-col gap-3 md:gap-4">
      <span className="sr-only">Cargando…</span>
      <div className="esqueleto h-28 w-full rounded-xl md:h-32" />
      <div className="grid gap-3 md:grid-cols-2 md:gap-4">
        <div className="esqueleto h-28 rounded-xl md:h-48" />
        <div className="esqueleto h-28 rounded-xl md:h-48" />
      </div>
      <div className="esqueleto h-12 w-full rounded-xl" />
    </div>
  )
}
