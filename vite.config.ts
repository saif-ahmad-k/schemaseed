import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: [
      '@faker-js/faker',
      '@faker-js/faker/locale/en',
      '@faker-js/faker/locale/es',
      '@faker-js/faker/locale/zh_CN',
      '@faker-js/faker/locale/ru',
      '@faker-js/faker/locale/fr',
      '@faker-js/faker/locale/de',
      '@faker-js/faker/locale/pt_BR',
      '@faker-js/faker/locale/ja',
      '@faker-js/faker/locale/ar',
    ],
  },
})
