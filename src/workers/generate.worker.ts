import { generateDataset } from '../lib/generate'
import type { GenerateRequest, WorkerResponse } from '../types'

addEventListener('message', (event: MessageEvent<GenerateRequest>) => {
  const request = event.data
  try {
    const result = generateDataset(request)
    const response: WorkerResponse = { id: request.id, ok: true, ...result }
    postMessage(response)
  } catch (error) {
    const response: WorkerResponse = {
      id: request.id,
      ok: false,
      error: error instanceof Error ? error.message : 'Could not generate rows.',
    }
    postMessage(response)
  }
})
