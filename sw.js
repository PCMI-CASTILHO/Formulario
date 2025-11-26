importScripts('https://cdn.jsdelivr.net/npm/idb@8/build/umd.js');

const CACHE_NAME = 'formulario-cache-v306';

const ASSETS_TO_CACHE = [
  'https://servicos.pesoexato.com/',
  'https://servicos.pesoexato.com/index.html',
  'https://servicos.pesoexato.com/manifest.json',
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.28/jspdf.plugin.autotable.min.js',
  'https://cdn.jsdelivr.net/npm/idb@8/build/umd.js'
];

// Instalação
self.addEventListener('install', (event) => {
  console.log('🟢 Service Worker: Instalando...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📦 Cacheando arquivos');
        return cache.addAll([
          'https://servicos.pesoexato.com/',
          'https://servicos.pesoexato.com/index.html'
        ]).catch(error => {
          console.warn('⚠️ Alguns arquivos não puderam ser cacheados:', error);
        });
      })
      .then(() => self.skipWaiting())
  );
});

// Ativação
self.addEventListener('activate', (event) => {
  console.log('🔵 Service Worker: Ativando...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Removendo cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Interceptação de requisições
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  if (event.request.method !== 'GET') return;
  
  if (url.hostname === 'vps.pesoexato.com') {
    event.respondWith(fetch(event.request));
    return;
  }
  
  if (url.hostname !== 'servicos.pesoexato.com') {
    event.respondWith(
      caches.match(event.request)
        .then(cached => cached || fetch(event.request))
    );
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        return fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse.ok) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME)
                .then((cache) => cache.put(event.request, responseClone));
            }
            return networkResponse;
          })
          .catch(() => {
            if (cachedResponse) {
              console.log('📂 Servindo do cache (offline)');
              return cachedResponse;
            }
            
            if (event.request.destination === 'document' || 
                event.request.mode === 'navigate') {
              return caches.match('https://servicos.pesoexato.com/index.html')
                .then(html => html || criarPaginaOffline());
            }
            
            return new Response('Recurso offline', { status: 503 });
          });
      })
  );
});

// Página offline
function criarPaginaOffline() {
  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Modo Offline</title>
    <style>
        body { 
            font-family: 'Inter', sans-serif; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0;
            padding: 20px;
        }
        .offline-container {
            background: white;
            padding: 40px;
            border-radius: 20px;
            text-align: center;
            max-width: 500px;
        }
        h1 { color: #333; }
        p { color: #666; line-height: 1.6; }
        .btn {
            background: #667eea;
            color: white;
            padding: 12px 30px;
            border: none;
            border-radius: 10px;
            cursor: pointer;
            margin-top: 20px;
        }
    </style>
</head>
<body>
    <div class="offline-container">
        <h1>📶 Você está offline</h1>
        <p>Os formulários continuam funcionando e serão sincronizados quando a conexão voltar.</p>
        <button class="btn" onclick="window.location.reload()">Tentar Novamente</button>
    </div>
</body>
</html>`;
  
  return new Response(html, {
    headers: { 'Content-Type': 'text/html' }
  });
}

// ============================================
// BACKGROUND SYNC - APENAS ENVIA OS PDFs JÁ GERADOS
// ============================================

self.addEventListener('sync', (event) => {
    if (event.tag === 'background-sync-formularios') {
        console.log('🔄 Background Sync disparado!');
        event.waitUntil(sincronizarFormulariosEmBackground());
    }
});

async function sincronizarFormulariosEmBackground() {
    try {
        console.log('📱 Iniciando sincronização em background...');
        
        const db = await idb.openDB('FormulariosDB', 4);
        const todosForms = await db.getAll('formularios');
        const pendentes = todosForms.filter(f => !f.sincronizado);
        
        console.log(`📋 ${pendentes.length} formulários pendentes`);
        
        if (pendentes.length === 0) {
            console.log('✅ Nenhum formulário pendente');
            return;
        }
        
        for (const form of pendentes) {
            try {
                console.log(`📤 Enviando formulário ${form.id}...`);
                
                // ✅ OS PDFs JÁ ESTÃO NO FORMULÁRIO (gerados no index.html)
                // Apenas pegamos os dados e enviamos
                const payload = {
					id: form.id,
					cliente: form.cliente,
					servico: form.servico,
					formData: form.formData,
                    // ✅ Verifica se os PDFs já foram gerados
                    fichaPDF: form.fichaPDF || null,
                    relatorioPDF: form.relatorioPDF || null,
					chaveUnica: form.chaveUnica
                },
				chave: form.chaveUnica
			};
                
                // Se os PDFs não existirem, notifica o cliente para gerá-los
                if (!payload.fichaPDF || !payload.relatorioPDF) {
                    console.warn(`⚠️ Formulário ${form.id} sem PDFs. Aguardando geração...`);
                    
                    // Notifica o cliente (página) para gerar os PDFs
                    const clients = await self.clients.matchAll();
                    clients.forEach(client => {
                        client.postMessage({
                            type: 'GENERATE_PDFS',
                            formId: form.id
                        });
                    });
                    continue;
                }
                
                const response = await fetch('https://vps.pesoexato.com/servico_set', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                if (response.ok) {
                    form.sincronizado = true;
                    form.syncedAt = new Date().toISOString();
                    await db.put('formularios', form);
                    console.log(`✅ Formulário ${form.id} sincronizado`);
                } else {
                    console.error(`❌ Erro HTTP ${response.status}`);
                }
                
            } catch (error) {
                console.error(`❌ Erro ao enviar formulário ${form.id}:`, error);
            }
        }
        
        console.log('✅ Sincronização concluída');
        
    } catch (error) {
        console.error('❌ Erro crítico:', error);
        throw error;
    }
}
