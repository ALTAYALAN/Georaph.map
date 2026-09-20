import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        strictPort: true,
        // Windows file replacement events can be missed by native watching.
        watch: process.platform === 'win32' ? { usePolling: true, interval: 500 } : undefined
    }
})
