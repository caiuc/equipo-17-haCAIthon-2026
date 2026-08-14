import path from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // loadEnv y no process.env: Vite NO carga el .env dentro de su propio archivo
  // de configuracion. Sin esto, poner VITE_DEV_API_TARGET en frontend/.env no
  // hacia absolutamente nada y el proxy seguia apuntando a localhost -- se
  // perdio un buen rato creyendo estar probando contra produccion.
  //
  // El tercer argumento vacio es a proposito: sin el, loadEnv solo devuelve las
  // variables con prefijo VITE_, y este target es config de servidor de
  // desarrollo, no algo que deba viajar al bundle del navegador.
  const env = loadEnv(mode, import.meta.dirname, '')

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, './src'),
      },
    },
    server: {
      // Con este proxy el front llama a rutas relativas (/api/...) y en dev no
      // hay CORS ni URLs que configurar. En produccion el mismo CloudFront
      // enruta /api al ALB, asi que las llamadas siguen siendo relativas.
      proxy: {
        '/api': {
          // La variable de entorno del proceso gana sobre el .env, para poder
          // apuntar a produccion en una sola corrida sin editar archivos:
          //   VITE_DEV_API_TARGET=https://... pnpm --filter @equipo17/web dev
          target: process.env.VITE_DEV_API_TARGET || env.VITE_DEV_API_TARGET || 'http://localhost:3000',
          changeOrigin: true,
        },
      },
    },
  }
})
