import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// Configuração mínima: só o plugin do Vue.
// O dev server usa a porta padrão do Vite: http://localhost:5173
export default defineConfig({
  plugins: [vue()],
});
