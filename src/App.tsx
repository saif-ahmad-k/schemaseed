import { useEffect, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { AdSlot } from './components/AdSlot'
import { DocsDialog } from './components/DocsDialog'
import { EditorPane } from './components/EditorPane'
import { Header } from './components/Header'
import { OutputPane } from './components/OutputPane'
import { SampleDialog } from './components/SampleDialog'
import { useApp } from './store'

function FlowBar() {
  const tables = useApp((state) => state.tables)
  const generated = useApp((state) => state.generated)
  const dirty = useApp((state) => state.dirty)
  const previewReady = generated.length > 0 && !dirty
  const current = tables.length === 0 ? 1 : previewReady ? 3 : 2
  const steps = ['Paste a schema', 'Generate a preview', 'Download JSON, CSV, or SQL']

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line bg-panel px-3 py-1.5 text-[11px]">
      <ol aria-label="How to use SchemaSeed" className="flex flex-wrap items-center gap-1.5">
        {steps.map((label, index) => {
          const number = index + 1
          const done = number < current || (number === 3 && previewReady)
          return (
            <li key={label} className="flex items-center gap-1.5">
              {index > 0 && <span className="text-mist/50">→</span>}
              <span className={done || number === current ? 'text-foam' : 'text-mist'} aria-current={number === current ? 'step' : undefined}>
                {number}. {label}
              </span>
            </li>
          )
        })}
      </ol>
      <p className="text-mist sm:ml-auto">No account. The schema and the rows stay in this browser.</p>
    </div>
  )
}

function useWideScreen() {
  const [wide, setWide] = useState(() => window.matchMedia('(min-width: 1024px)').matches)
  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)')
    const onChange = () => setWide(media.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])
  return wide
}

export default function App() {
  const docsOpen = useApp((state) => state.docsOpen)
  const sampleOpen = useApp((state) => state.sampleOpen)
  const wide = useWideScreen()
  const [leftWidth, setLeftWidth] = useState(560)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        void useApp.getState().generate()
      }
    }
    window.addEventListener('keydown', onKey)
    const params = new URLSearchParams(window.location.search)
    if (params.get('checkout') === 'done') {
      params.delete('checkout')
      const query = params.toString()
      window.history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}`)
    }
    return () => {
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  function onResizeStart(event: ReactPointerEvent<HTMLDivElement>) {
    if (!wide) return
    event.preventDefault()
    const handle = event.currentTarget
    const startX = event.clientX
    const startWidth = leftWidth
    handle.setPointerCapture(event.pointerId)
    const move = (moveEvent: PointerEvent) => {
      const next = Math.min(Math.max(startWidth + moveEvent.clientX - startX, 320), window.innerWidth - 380)
      setLeftWidth(next)
    }
    const stop = () => {
      handle.removeEventListener('pointermove', move)
      handle.removeEventListener('pointerup', stop)
    }
    handle.addEventListener('pointermove', move)
    handle.addEventListener('pointerup', stop)
  }

  return (
    <div className="flex min-h-dvh flex-col bg-ink text-foam lg:h-dvh lg:min-h-0 lg:overflow-hidden">
      <Header />
      <FlowBar />
      <div className="flex flex-col lg:min-h-0 lg:flex-1 lg:flex-row lg:overflow-hidden">
        <div
          className="h-[70vh] min-h-[520px] lg:h-full lg:min-h-0 lg:flex-none"
          style={wide ? { width: leftWidth } : undefined}
        >
          <EditorPane />
        </div>
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize schema panel"
          aria-valuemin={320}
          aria-valuenow={leftWidth}
          tabIndex={0}
          onPointerDown={onResizeStart}
          onKeyDown={(event) => {
            const step = event.shiftKey ? 80 : 24
            if (event.key === 'ArrowLeft') {
              event.preventDefault()
              setLeftWidth((width) => Math.max(320, width - step))
            }
            if (event.key === 'ArrowRight') {
              event.preventDefault()
              setLeftWidth((width) => Math.min(window.innerWidth - 380, width + step))
            }
          }}
          className="hidden w-1.5 shrink-0 cursor-col-resize bg-line hover:bg-amber/50 lg:block"
        />
        <div className="h-[70vh] min-h-[440px] min-w-0 border-t border-line lg:h-full lg:min-h-0 lg:flex-1 lg:border-t-0">
          <OutputPane />
        </div>
      </div>
      <footer className="flex h-11 shrink-0 items-center justify-between gap-3 border-t border-line bg-panel px-3">
        <nav className="flex min-w-0 items-center gap-3 text-xs text-mist">
          <a href="/schema-seed.html" className="hover:text-foam">
            Schema seed
          </a>
          <a href="/random-data-generator.html" className="hover:text-foam">
            Random data
          </a>
          <a href="/test-data-generator.html" className="hover:text-foam">
            Test data
          </a>
          <a href="/guides.html" className="hover:text-foam">
            Guides
          </a>
        </nav>
        <AdSlot />
      </footer>
      {docsOpen && <DocsDialog />}
      {sampleOpen && <SampleDialog />}
    </div>
  )
}
