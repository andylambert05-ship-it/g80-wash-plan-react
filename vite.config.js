import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'

// Deployed commit, injected at build time. The deploy workflow builds from a
// checkout of the pushed commit, so this always matches what's live — same
// source of truth the SW cache version uses.
let commit = 'dev'
try { commit = execSync('git rev-parse --short HEAD').toString().trim() } catch {}

export default defineConfig({
  plugins: [react()],
  base: '/g80-wash-plan-react/',
  define: {
    __COMMIT__: JSON.stringify(commit),
  },
})
