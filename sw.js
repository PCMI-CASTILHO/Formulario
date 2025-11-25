/* ==========================================================
   SERVICE WORKER – OTIMIZADO PARA PWA + BACKGROUND SYNC
   Compatível com envio de PDFs grandes e API externa
   ========================================================== */

importScripts('https://cdn.jsdelivr.net/npm/idb@8/build/umd.js');

const CACHE_NAME = 'formulario-cache-v200';

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

/* ==========================================================
   INSTALAÇÃO
   ========================================================== */
self.addEventListener('install', event => {
  console.log('🟢 Instalando Service Worker v200');

  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS)
        .catch(err => console.warn("⚠️ Erro ao cachear arquivos:", err));
    }).then(() => self.skipWaiting())
  );
});

/* ==========================================================
   ATIVAÇÃO
   ========================================================== */
self.addEventListener('activate', event => {
  console.log('🔵 Ativando SW e limpando caches antigos…');

  event.waitUntil(
    caches.keys().then(names =>
      Promise.all(
        names.map(name => {
          if (name !== CACHE_NAME) {
            console.log('🗑️ Apagando cache antigo:', name);
            return caches.delete(name);
          }
        })
      )
    ).then(() => self.clients.claim())
  );
});

/* ==========================================================
   INTERCEPTAÇÃO DE REQUISIÇÕES
   ========================================================== */
self.addEventListener('fetch', event => {
  const req = event.request;

  // 🚫 Não interceptar POST, PUT, DELETE — deixa ir direto para a internet
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // 🚫 Não interceptar chamadas para seu servidor real (IMPORTANTE!)
  if (url.hostname === 'vps.pesoexato.com') return;

  // Estratégia cache → rede → fallback offline
  event.respondWith(
    caches.match(req).then(cacheRes => {
      if (cacheRes) return cacheRes;

      return fetch(req)
        .then(netRes => {
          if (netRes.ok && req.url.startsWith(location.origin)) {
            caches.open(CACHE_NAME).then(cache => cache.put(req, netRes.clone()));
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
    console.log("📡 Background Sync disparado!");
    event.waitUntil(sincronizarFormularios());
  }
});

/* ==========================================================
   FUNÇÃO DE SINCRONIZAÇÃO REAL
   ========================================================== */
async function sincronizarFormularios() {
  try {
    const db = await idb.openDB('FormulariosDB', 4);
    const store = db.transaction('formularios').store;

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

      // ⚠️ CORREÇÃO CRÍTICA: salvar o response!
      const response = await fetch('https://vps.pesoexato.com/servico_set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        console.log(`✅ Formulário ${form.id} sincronizado`);

        form.sincronizado = true;
        form.syncedAt = new Date().toISOString();

        await db.put('formularios', form);
      } else {
        console.error(`❌ Falha ao sincronizar ${form.id}`, response.status);
      }
    }
  } catch (err) {
    console.error('🔥 Erro durante o Background Sync:', err);
  }
}
