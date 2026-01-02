import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
		host: '0.0.0.0',
		allowedHosts: ['andreracicot.com'],
    proxy: {
      '/api': {
        target: 'http://andreracicot.com:31337',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
});