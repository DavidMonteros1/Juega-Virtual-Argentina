import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const root = import.meta.dirname;

export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: {
        index: resolve(root, 'index.html'),
        login: resolve(root, 'login.html'),
        register: resolve(root, 'register.html'),
        lobby: resolve(root, 'lobby.html'),
        administracion: resolve(root, 'administracion.html'),
        auditoriaIA: resolve(root, 'auditoria-ia.html'),
        mesa: resolve(root, 'juegos/mesa.html'),
        tragamonedas: resolve(root, 'juegos/tragamonedas/index.html'),
        loteria: resolve(root, 'juegos/loteria/index.html'),
        dados: resolve(root, 'juegos/dados/index.html'),
        minas: resolve(root, 'juegos/minas/index.html'),
        crash: resolve(root, 'juegos/crash/index.html'),
        ruleta: resolve(root, 'juegos/ruleta/index.html'),
        jackpot: resolve(root, 'juegos/jackpot/index.html'),
      },
    },
  },
});
