import { execSync } from 'node:child_process'

// Cloudflare Workers Builds runs `npx wrangler deploy` and does not run a
// separate build command. Produce dist during install on that service only.
if (process.env.WORKERS_CI !== '1') {
  process.exit(0)
}

execSync('npm run build', { stdio: 'inherit' })
