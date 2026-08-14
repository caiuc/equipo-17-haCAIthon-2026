import path from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Vite no vuelca los .env en process.env al evaluar este archivo: los carga
  // despues, y solo para el codigo del cliente (import.meta.env). Sin loadEnv,
  // VITE_DEV_API_TARGET se leia como undefined y el proxy caia siempre al
  // localhost:3000 del default, en silencio.
  const env = loadEnv(mode, import.meta.dirname)

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, './src'),
      },
    },
    server: {
      // Con este proxy el front llama a rutas relativas (/api/...) y en dev no hay
      // CORS ni URLs que configurar. En produccion el mismo CloudFront enruta /api
      // al ALB, asi que las llamadas siguen siendo relativas.
      proxy: {
        '/api': {
          target: env.VITE_DEV_API_TARGET || 'http://localhost:3000',
          changeOrigin: true,
        },
      },
    },
  }
})
