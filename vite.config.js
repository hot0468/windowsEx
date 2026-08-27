import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // On Windows, 'localhost' can resolve to ::1 alone, so the dev server binds
  // IPv6 only and the browser's 127.0.0.1 is refused. Bind the IPv4 loopback
  // explicitly — still local-only, but the address browsers actually try.
  //
  // The port is pinned because the save lives in localStorage, which the
  // browser scopes to the origin: let vite wander to 5174 when 5173 is busy
  // and the game comes up with no memory of the week. Failing loudly on a
  // taken port is better than silently starting somewhere the save is not.
  server: { host: '127.0.0.1', port: 5173, strictPort: true }
})
