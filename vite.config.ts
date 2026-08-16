import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(), 
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        manifestFilename: 'manifest.json',
        workbox: {
          maximumFileSizeToCacheInBytes: 6000000,
          globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest,json}'],
        },
        manifest: {
          name: 'Agos: Inventory Management',
          short_name: 'Agos',
          description: 'Premium Filipino-inspired inventory and sales management system.',
          theme_color: '#1A2B4B',
          icons: [
            {
              src: 'https://raw.githubusercontent.com/lucide-react/lucide/main/icons/package.svg',
              sizes: '192x192',
              type: 'image/svg+xml'
            },
            {
              src: 'https://raw.githubusercontent.com/lucide-react/lucide/main/icons/package.svg',
              sizes: '512x512',
              type: 'image/svg+xml'
            }
          ]
        }
      })
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || ''),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: false,
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore'],
            'vendor-charts': ['recharts'],
            'vendor-icons': ['lucide-react'],
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
