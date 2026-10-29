import { BookOpen, Mail } from 'lucide-react'
import { useApp } from '../store'

export function Header() {
  const setDocsOpen = useApp((state) => state.setDocsOpen)

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
      <span className="hidden text-xs text-mist sm:inline">Paste a schema. Download JSON, CSV, or SQL.</span>
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
      </div>
    </header>
  )
}
