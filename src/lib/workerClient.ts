import type { GenerateRequest, GenerateResult, WorkerResponse } from '../types'

let worker: Worker | null = null
let nextId = 0

export function runGenerate(input: Omit<GenerateRequest, 'id'>): Promise<GenerateResult> {
  if (!worker) {
    worker = new Worker(new URL('../workers/generate.worker.ts', import.meta.url), { type: 'module' })
  }
  const id = ++nextId
  const active = worker
  return new Promise((resolve, reject) => {
    const finish = () => {
      active.removeEventListener('message', onMessage)
      active.removeEventListener('error', onError)
    }
    const onMessage = (event: MessageEvent<WorkerResponse>) => {
      if (event.data.id !== id) return
      finish()
      if (event.data.ok) resolve(event.data)
      else reject(new Error(event.data.error))
    }
    const onError = () => {
      finish()
      reject(new Error('The generator worker failed to start.'))
    }
    active.addEventListener('message', onMessage)
    active.addEventListener('error', onError)
    active.postMessage({ ...input, id } satisfies GenerateRequest)
  })
}
