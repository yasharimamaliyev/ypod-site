import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { renderPages } from './scripts/render-pages.mjs';

// Template və tərcümələr dəyişəndə 3 dil səhifəsini yenidən yaradır
function i18nPages() {
  return {
    name: 'ypod-i18n-pages',
    config() { renderPages(); },
    configureServer(server) {
      const watched = [resolve('src/template.html'), resolve('src/i18n')];
      server.watcher.add(watched);
      server.watcher.on('change', file => {
        if (file.endsWith('template.html') || file.includes('/i18n/')) {
          try { renderPages(); } catch (e) { console.error(e.message); }
          server.ws.send({ type: 'full-reload' });
        }
      });
    },
  };
}

export default defineConfig({
  root: 'src',
  publicDir: resolve('public'),
  // Nisbi yollar: sayt həm github.io/<repo>/ altında, həm də öz domenində işləsin
  base: './',
  plugins: [i18nPages()],
  build: {
    outDir: resolve('dist'),
    emptyOutDir: true,
    target: 'es2020',
    rollupOptions: {
      input: {
        az: resolve('src/index.html'),
        en: resolve('src/en/index.html'),
        ru: resolve('src/ru/index.html'),
      },
    },
  },
  server: { port: 5181 },
});
