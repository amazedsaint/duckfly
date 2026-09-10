import { defineConfig } from 'vite';
export default defineConfig({
  worker:{format:'es'},
  server:{port:5173,strictPort:true},
  preview:{port:4173,strictPort:true},
  build:{target:'es2022',chunkSizeWarningLimit:800},
});
