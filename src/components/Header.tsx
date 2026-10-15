import { BookOpen, Mail } from 'lucide-react'
import { useApp } from '../store'

export function Header() {
  const tier = useApp((state) => state.tier)
  const plan = useApp((state) => state.plan)
  const expiresAt = useApp((state) => state.expiresAt)
  const setDocsOpen = useApp((state) => state.setDocsOpen)
  const setProOpen = useApp((state) => state.setProOpen)
  const hoursLeft = expiresAt ? Math.max(1, Math.ceil((expiresAt - Date.now()) / 3_600_000)) : null
  const proLabel = plan === 'day' && hoursLeft ? `Pro · ${hoursLeft}h` : 'Pro'

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-line bg-panel px-3">
      <div className="flex items-center gap-2">
        <span className="grid h-6 w-6 place-items-center rounded-md bg-amber" aria-hidden="true">
          <span className="flex w-3.5 flex-col gap-[3px]">
            <span className="h-[1.5px] w-full rounded bg-[#24180b]" />
            <span className="h-[1.5px] w-2.5 rounded bg-[#24180b]" />
            <span className="h-[1.5px] w-3 rounded bg-[#24180b]" />
          </span>
        </span>
        <h1 className="text-sm font-semibold tracking-tight">SchemaSeed</h1>
      </div>
      <span className="hidden text-xs text-mist sm:inline">Random test data from a schema, in the browser</span>
      <div className="ml-auto flex items-center gap-1.5">
        <a
          href="mailto:saifahmedkayani@gmail.com"
          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-mist hover:bg-white/5 hover:text-foam"
        >
          <Mail size={14} />
          Contact
        </a>
        <button
          type="button"
          onClick={() => setDocsOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-mist hover:bg-white/5 hover:text-foam"
        >
          <BookOpen size={14} />
          Docs
        </button>
        <button
          type="button"
          onClick={() => setProOpen(true)}
          className={
            tier === 'pro'
              ? 'rounded-md bg-amber px-2.5 py-1.5 text-xs font-semibold text-[#24180b] hover:bg-[#efb25c]'
              : 'rounded-md border border-line px-2.5 py-1.5 text-xs text-foam hover:bg-white/5'
          }
        >
          {tier === 'pro' ? proLabel : 'Upgrade'}
        </button>
      </div>
    </header>
  )
}
