import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Em dev local, /api é redirecionado ao backend local.
// Em produção, o nginx do container faz esse proxy (ver nginx.conf).
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:8080'
    }
  }
});
