import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    assetsInlineLimit: 200000,
    cssCodeSplit: false,
    outDir: 'dist-artifact',
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
})
