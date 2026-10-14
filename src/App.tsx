import { useEffect, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { AdSlot } from './components/AdSlot'
import { DocsDialog } from './components/DocsDialog'
import { EditorPane } from './components/EditorPane'
import { Header } from './components/Header'
import { OutputPane } from './components/OutputPane'
import { ProDialog } from './components/ProDialog'
import { SampleDialog } from './components/SampleDialog'
import { useApp } from './store'

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
  const proOpen = useApp((state) => state.proOpen)
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
      useApp.getState().setProOpen(true)
      useApp.setState({ notice: 'Payment completed. Paste the license key from the receipt.' })
    }
    void useApp.getState().refreshLicense()
    const timer = window.setInterval(() => {
      const state = useApp.getState()
      if (state.tier === 'pro' && state.expiresAt !== null && state.expiresAt <= Date.now()) state.clearLicense()
    }, 30_000)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.clearInterval(timer)
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
          onPointerDown={onResizeStart}
          className="hidden w-1.5 shrink-0 cursor-col-resize bg-line hover:bg-amber/50 lg:block"
        />
        <div className="h-[70vh] min-h-[440px] min-w-0 border-t border-line lg:h-full lg:min-h-0 lg:flex-1 lg:border-t-0">
          <OutputPane />
        </div>
      </div>
      <footer className="flex h-11 shrink-0 items-center justify-end border-t border-line bg-panel px-3">
        <AdSlot />
      </footer>
      {docsOpen && <DocsDialog />}
      {proOpen && <ProDialog />}
      {sampleOpen && <SampleDialog />}
    </div>
  )
}
