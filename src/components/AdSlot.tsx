import { AD } from '../lib/ad'

export function AdSlot() {
  const className = 'flex h-8 w-44 items-center justify-center overflow-hidden rounded-md border border-line bg-ink text-[10px] uppercase tracking-wider text-mist sm:w-56'
  const content = AD.image ? <img src={AD.image} alt={AD.alt} className="h-full w-full object-contain" /> : <span>Ad</span>
  if (!AD.href) {
    return (
      <div className={className} aria-label="Advertisement">
        {content}
      </div>
    )
  }
  return (
    <a href={AD.href} target="_blank" rel="sponsored noopener noreferrer" className={className} aria-label="Advertisement">
      {content}
    </a>
  )
}
