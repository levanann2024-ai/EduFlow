import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  /* ĐÃ SỬA: Giữ proxy cho máy Localhost để bạn tiện test offline sau này */
  server: {
    proxy: {
      '/api': {
        target: 'https://onrender.com', // DÁN LINK RENDER THẬT CỦA BẠN VÀO ĐÂY
        changeOrigin: true,
        secure: false,
      }
    },
  },
});