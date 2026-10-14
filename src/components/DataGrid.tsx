import { useVirtualizer } from '@tanstack/react-virtual'
import { useEffect, useRef } from 'react'

function display(value: unknown) {
  if (value === null || value === undefined) return null
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export function DataGrid({
  columns,
  rows,
}: {
  columns: string[]
  rows: Record<string, unknown>[]
}) {
  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 34,
    overscan: 16,
  })

  useEffect(() => {
    parentRef.current?.scrollTo({ top: 0 })
  }, [columns, rows])

  const template = `52px repeat(${Math.max(columns.length, 1)}, minmax(148px, 1fr))`

  return (
    <div ref={parentRef} className="h-full overflow-auto">
      <div style={{ minWidth: 52 + columns.length * 148 }}>
        <div
          className="sticky top-0 z-10 grid border-b border-line bg-[#12151c] text-[11px] uppercase tracking-wide text-mist"
          style={{ gridTemplateColumns: template }}
        >
          <div className="px-3 py-2">#</div>
          {columns.map((column) => (
            <div key={column} className="truncate px-3 py-2 font-mono normal-case tracking-normal">
              {column}
            </div>
          ))}
        </div>
        {rows.length === 0 ? (
          <div className="px-4 py-10 text-sm text-mist">Generate to fill this grid. The schema is already parsed.</div>
        ) : (
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {virtualizer.getVirtualItems().map((item) => {
              const row = rows[item.index]
              return (
                <div
                  key={item.key}
                  className="absolute left-0 top-0 grid w-full border-b border-white/5 text-[12px] hover:bg-white/[0.03]"
                  style={{ height: item.size, transform: `translateY(${item.start}px)`, gridTemplateColumns: template }}
                >
                  <div className="px-3 py-2 font-mono text-mist">{item.index + 1}</div>
                  {columns.map((column) => {
                    const text = display(row[column])
                    return (
                      <div key={column} className="truncate px-3 py-2 font-mono" title={text ?? 'null'}>
                        {text === null ? <span className="text-white/30">null</span> : text}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
