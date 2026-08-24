import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // On Windows, 'localhost' can resolve to ::1 alone, so the dev server binds
  // IPv6 only and the browser's 127.0.0.1 is refused. Bind the IPv4 loopback
  // explicitly — still local-only, but the address browsers actually try.
  server: { host: '127.0.0.1' }
})
