import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Set VITE_PAYLOAD_URL=https://xhr.cms-admin.x-or.cloud trong .env.local
// để portal local talk thẳng tới Payload CMS đang chạy trên VM.
// (Hoặc trỏ về local CMS http://localhost:3002 nếu anh chạy `cms/` cùng máy.)
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.VITE_PAYLOAD_URL || 'https://xhr.cms-admin.x-or.cloud';
  return {
    plugins: [react()],
    server: {
      port: 5173,
      // /api → Payload backend. Portal code gọi `/api/...`, Vite proxy.
      proxy: {
        '/api': {
          target,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});
