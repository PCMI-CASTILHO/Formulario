/* ==========================================================
   SERVICE WORKER – OTIMIZADO PARA PWA + BACKGROUND SYNC
   ========================================================== */

importScripts('https://cdn.jsdelivr.net/npm/idb@8/build/umd.js');

const CACHE_NAME = 'formulario-cache-v202';

const ASSETS = [
  './',
  './index.html',
  './manifest.json',

  // CDNs
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.28/jspdf.plugin.autotable.min.js',
  'https://cdn.jsdelivr.net/npm/idb@8/build/umd.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
      .catch(err => console.warn("Erro ao cachear:", err))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(names =>
      Promise.all(names.map(name => {
        if (name !== CACHE_NAME) return caches.delete(name);
      }))
    ).then(() => self.clients.claim())
  );
});

/* ==========================================================
   FETCH – CORRIGIDO (clone antes de usar)
   ========================================================== */

self.addEventListener('fetch', event => {
  const req = event.request;

  // Não intercepta POST
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Não intercepta API do servidor real
  if (url.hostname === 'vps.pesoexato.com') return;

  event.respondWith(
    caches.match(req).then(cacheRes => {
      if (cacheRes) return cacheRes;

      return fetch(req)
        .then(netRes => {
          const clone = netRes.clone();

          if (netRes.ok && req.url.startsWith(location.origin)) {
            caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
          }

          return netRes;
        })
        .catch(() => {
          if (req.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
    })
  );
});

/* ==========================================================
   BACKGROUND SYNC
   ========================================================== */

self.addEventListener('sync', event => {
  if (event.tag === 'background-sync-formularios') {
    event.waitUntil(sincronizarFormularios());
  }
});

async function sincronizarFormularios() {
  try {
    const db = await idb.openDB('FormulariosDB', 4);
    const store = db.transaction('formularios', 'readwrite').store;

    const todos = await store.getAll();
    const pendentes = todos.filter(f => !f.sincronizado);

    console.log(`🔄 Encontrados ${pendentes.length} formulários pendentes`);

    for (const form of pendentes) {
      const payload = {
        chave: form.chaveUnica,
        pdf_ficha: form.pdfFicha,
        pdf_relatorio: form.pdfRelatorio
      };

      console.log(`📨 Enviando formulário ${form.id}`);

      const response = await fetch('https://vps.pesoexato.com/servico_set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        form.sincronizado = true;
        form.syncedAt = new Date().toISOString();
        await store.put(form);
        console.log(`✅ Formulário ${form.id} sincronizado`);
      } else {
        console.error(`❌ Erro no servidor: ${response.status}`);
      }
    }
  } catch (err) {
    console.error('🔥 Erro durante o Background Sync:', err);
  }
}
