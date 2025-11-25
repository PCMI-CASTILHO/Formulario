importScripts('https://cdn.jsdelivr.net/npm/idb@8/build/umd.js');
importScripts('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
importScripts('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.28/jspdf.plugin.autotable.min.js');

// Nome do cache – altere sempre que atualizar
const CACHE_NAME = 'formulario-cache-v302';

// Arquivos para cache inicial - URLs ABSOLUTAS
const ASSETS_TO_CACHE = [
  'https://pcmi-castilho.github.io/Formulario/',
  'https://pcmi-castilho.github.io/Formulario/index.html',
  'https://pcmi-castilho.github.io/Formulario/manifest.json',
  // CDNs externos que você usa
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.28/jspdf.plugin.autotable.min.js',
  'https://cdn.jsdelivr.net/npm/idb@8/build/umd.js'
];

// Instalação - cache dos arquivos essenciais
self.addEventListener('install', (event) => {
  console.log('🟢 Service Worker: Instalando...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📦 Service Worker: Cacheando arquivos essenciais');
        return cache.addAll([
          'https://pcmi-castilho.github.io/Formulario/',
          'https://pcmi-castilho.github.io/Formulario/index.html'
        ]).catch(error => {
          console.warn('⚠️ Alguns arquivos não puderam ser cacheados:', error);
        });
      })
      .then(() => {
        console.log('✅ Service Worker: Instalação completa');
        return self.skipWaiting();
      })
  );
});

// Ativação - limpa caches antigos
self.addEventListener('activate', (event) => {
  console.log('🔵 Service Worker: Ativando...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Service Worker: Removendo cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('✅ Service Worker: Ativação completa');
      return self.clients.claim();
    })
  );
});

// Interceptação de requisições - ESTRATÉGIA INTELIGENTE
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Ignora requisições não-GET
  if (event.request.method !== 'GET') return;
  
  // Para APIs de sincronização, sempre vai para rede
  if (url.hostname === 'vps.pesoexato.com') {
    event.respondWith(fetch(event.request));
    return;
  }
  
  // Para CDNs externas, tenta cache primeiro, depois rede
  if (url.hostname !== 'pcmi-castilho.github.io') {
    event.respondWith(
      caches.match(event.request)
        .then(cached => cached || fetch(event.request))
    );
    return;
  }
  
  // Para recursos do próprio site
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        return fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse.ok) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME)
                .then((cache) => {
                  cache.put(event.request, responseClone);
                });
            }
            return networkResponse;
          })
          .catch((error) => {
            if (cachedResponse) {
              console.log('📂 Servindo do cache (offline):', event.request.url);
              return cachedResponse;
            }
            
            if (event.request.destination === 'document' || 
                event.request.mode === 'navigate') {
              return caches.match('https://pcmi-castilho.github.io/Formulario/index.html')
                .then(html => html || criarPaginaOffline());
            }
            
            return new Response('Recurso offline', { status: 503 });
          });
      })
  );
});

// Página offline customizada
function criarPaginaOffline() {
  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Modo Offline - Serviço Selaves</title>
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
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            text-align: center;
            max-width: 500px;
        }
        .offline-icon {
            font-size: 80px;
            color: #667eea;
            margin-bottom: 20px;
        }
        h1 {
            color: #333;
            margin-bottom: 15px;
        }
        p {
            color: #666;
            line-height: 1.6;
            margin-bottom: 20px;
        }
        .btn {
            background: #667eea;
            color: white;
            padding: 12px 30px;
            border: none;
            border-radius: 10px;
            font-size: 16px;
            cursor: pointer;
            transition: background 0.3s;
        }
        .btn:hover {
            background: #5a6fd8;
        }
    </style>
</head>
<body>
    <div class="offline-container">
        <div class="offline-icon">📶</div>
        <h1>Você está offline</h1>
        <p>O aplicativo de formulários de serviço continua funcionando, mas algumas funcionalidades que requerem internet estarão temporariamente indisponíveis.</p>
        <p>Você pode continuar preenchendo formulários e eles serão sincronizados automaticamente quando a conexão voltar.</p>
        <button class="btn" onclick="window.location.reload()">Tentar Novamente</button>
    </div>
</body>
</html>`;
  
  return new Response(html, {
    headers: { 'Content-Type': 'text/html' }
  });
}

// ======== BACKGROUND SYNC - SINCRONIZAÇÃO EM BACKGROUND ========
self.addEventListener('sync', (event) => {
    if (event.tag === 'background-sync-formularios') {
        console.log('🔄 Background Sync disparado!');
        event.waitUntil(sincronizarFormulariosEmBackground());
    }
});

// ======== FUNÇÕES AUXILIARES PARA GERAÇÃO DE PDF NO SW ========
function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

async function carregarImagemSW(src) {
    try {
        const response = await fetch(src);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.warn('Erro ao carregar imagem no SW:', error);
        return null;
    }
}

async function gerarFichaPDFBase64SW(formData, materiais, fotos, assinaturas) {
    const { jsPDF } = self.jspdf;
    const doc = new jsPDF("p", "mm", "a4");
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let y = 20;

    // Logo e cabeçalho
    doc.setFillColor(0, 82, 163);
    doc.rect(0, 0, pageWidth, 17, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('FICHA DE MANUTENÇÃO', pageWidth / 2, 11, { align: 'center' });
    y = 22;

    const tableStyles4Col = {
        styles: { fontSize: 8, cellPadding: 3, halign: 'center' },
        headStyles: { fillColor: [0, 82, 163], textColor: 255, fontStyle: 'bold', halign: 'center' },
        columnStyles: {
            0: { cellWidth: (pageWidth - 16) / 4 },
            1: { cellWidth: (pageWidth - 16) / 4 },
            2: { cellWidth: (pageWidth - 16) / 4 },
            3: { cellWidth: (pageWidth - 16) / 4 }
        },
        margin: { left: 8, right: 8 },
        theme: 'grid'
    };
    
    const table1Data = [[
        formData.cliente || '-',
        formData.cidade || '-',
        formData.equipamento || '-',
        formData.numeroSerie || '-'
    ]];
    
    doc.autoTable({
        startY: y,
        head: [['CLIENTE', 'CIDADE', 'EQUIPAMENTO', 'Nº SÉRIE']],
        body: table1Data,
        ...tableStyles4Col
    });
    
    y = doc.lastAutoTable.finalY + 4;
    
    const table2Data = [[
        formData.tecnico || '-',
        formData.veiculo || '-',
        formData.estoque || '-',
        formData.dataInicial ? formatDate(formData.dataInicial) : '-'
    ]];
    
    doc.autoTable({
        startY: y,
        head: [['TÉCNICO', 'VEÍCULO', 'ESTOQUE', 'DATA']],
        body: table2Data,
        ...tableStyles4Col
    });
    
    y = doc.lastAutoTable.finalY + 8;
    
    doc.setTextColor(0, 82, 163);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('MATERIAIS UTILIZADOS', 10, y);
    y += 6;
    
    const materialsData = [];
    if (materiais && materiais.length > 0) {
        materiais.forEach(material => {
            materialsData.push([
                material.codigo || '',
                material.quantidade || '',
                material.descricao || ''
            ]);
        });
    } else {
        materialsData.push(['', '', 'Nenhum material utilizado.']);
    }
    
    doc.autoTable({
        startY: y,
        head: [['CÓDIGO', 'QNTD', 'MATERIAIS']],
        body: materialsData,
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [0, 82, 163], textColor: 255, fontStyle: 'bold', halign: 'center' },
        columnStyles: {
            0: { cellWidth: 25, halign: 'center' },
            1: { cellWidth: 20, halign: 'center' },
            2: { cellWidth: pageWidth - 16 - 45, halign: 'left' }
        },
        margin: { left: 8, right: 8 },
        theme: 'grid'
    });
    
    y = doc.lastAutoTable.finalY + 15;
    
    const signatureWidth = 50;
    const signatureHeight = 25;
    const spacing = (pageWidth - (signatureWidth * 2)) / 3;
    
    if (assinaturas && assinaturas.tecnico) {
        try {
            doc.addImage(assinaturas.tecnico, 'PNG', spacing, y, signatureWidth, signatureHeight);
        } catch (e) {
            console.error('Erro ao adicionar assinatura do técnico:', e);
        }
    }
    
    if (assinaturas && assinaturas.cliente) {
        try {
            doc.addImage(assinaturas.cliente, 'PNG', spacing * 2 + signatureWidth, y, signatureWidth, signatureHeight);
        } catch (e) {
            console.error('Erro ao adicionar assinatura do cliente:', e);
        }
    }
    
    y += signatureHeight + 2;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.line(spacing, y, spacing + signatureWidth, y);
    doc.line(spacing * 2 + signatureWidth, y, spacing * 2 + signatureWidth * 2, y);
    
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('TÉCNICO', spacing + signatureWidth / 2, y + 3, { align: 'center' });
    doc.text('CLIENTE', spacing * 2 + signatureWidth + signatureWidth / 2, y + 3, { align: 'center' });
    
    return doc.output('datauristring');
}

async function gerarRelatorioPDFBase64SW(formData, materiais, fotos, assinaturas) {
    const { jsPDF } = self.jspdf;
    const doc = new jsPDF("p", "mm", "a4");
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let y = 20;

    doc.setFillColor(0, 82, 163);
    doc.rect(0, 0, pageWidth, 17, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('RELATÓRIO DE PRESTAÇÃO DE SERVIÇO', pageWidth / 2, 11, { align: 'center' });
    y = 22;

    const tableStyles3Col = {
        styles: { fontSize: 8, cellPadding: 3, halign: 'center' },
        headStyles: { fillColor: [0, 82, 163], textColor: 255, fontStyle: 'bold', halign: 'center' },
        columnStyles: {
            0: { cellWidth: (pageWidth - 16) / 3, halign: 'center' },
            1: { cellWidth: (pageWidth - 16) / 3, halign: 'center' },
            2: { cellWidth: (pageWidth - 16) / 3, halign: 'center' }
        },
        margin: { left: 8, right: 8 },
        theme: 'grid'
    };
    
    const table1Data = [[
        formData.cliente || '-',
        formData.cidade || '-',
        formData.equipamento || '-'
    ]];
    
    doc.autoTable({
        startY: y,
        head: [['CLIENTE', 'CIDADE', 'EQUIPAMENTO']],
        body: table1Data,
        ...tableStyles3Col
    });
    
    y = doc.lastAutoTable.finalY + 4;
    
    const table2Data = [[
        formData.tecnico || '-',
        formData.dataInicial ? formatDate(formData.dataInicial) : '-',
        formData.dataFinal ? formatDate(formData.dataFinal) : '-'
    ]];
    
    doc.autoTable({
        startY: y,
        head: [['TÉCNICO', 'DATA INICIAL', 'DATA FINAL']],
        body: table2Data,
        ...tableStyles3Col
    });
    
    y = doc.lastAutoTable.finalY + 4;
    
    const table3Data = [[
        formData.servico || '-',
        formData.horaInicial || '-',
        formData.horaFinal || '-'
    ]];
    
    doc.autoTable({
        startY: y,
        head: [['SERVIÇO', 'HORÁRIO INICIAL', 'HORÁRIO FINAL']],
        body: table3Data,
        ...tableStyles3Col
    });
    
    y = doc.lastAutoTable.finalY + 8;
    
    doc.setTextColor(0, 82, 163);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('RELATÓRIO DA MÁQUINA', 10, y);
    y += 6;
    
    const relatorio = formData.relatorioMaquina || 'Nenhum relatório preenchido.';
    
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    
    const margin = 10;
    const textWidth = pageWidth - (margin * 2);
    const lineHeight = 4.5;
    
    const lines = doc.splitTextToSize(relatorio, textWidth);
    const textHeight = lines.length * lineHeight;
    
    if (y + textHeight + 30 > pageHeight) {
        doc.addPage();
        y = 20;
    }
    
    doc.setFillColor(245, 248, 251);
    doc.setDrawColor(208, 218, 230);
    doc.roundedRect(margin - 2, y - 2, textWidth + 4, textHeight + 4, 2, 2, 'FD');
    
    doc.text(lines, margin, y + 2);
    y += textHeight + 10;
    
    if (fotos && fotos.length > 0) {
        if (y + 50 > pageHeight) {
            doc.addPage();
            y = 20;
        }
        
        doc.setTextColor(0, 82, 163);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('FOTOS DO SERVIÇO', 10, y);
        y += 6;
        
        const numFotos = fotos.length;
        let imgWidth = 40;
        let imgHeight = 30;
        let imgsPerRow = 4;
        
        const spacing = (pageWidth - 16 - (imgWidth * imgsPerRow)) / (imgsPerRow + 1);
        let currentX = 8 + spacing;
        let currentY = y;
        let photoCount = 0;
        
        for (let i = 0; i < numFotos; i++) {
            if (photoCount > 0 && photoCount % imgsPerRow === 0) {
                currentY += imgHeight + 6;
                
                if (currentY + imgHeight > pageHeight - 15) {
                    doc.addPage();
                    currentY = 20;
                }
                
                currentX = 8 + spacing;
            }
            
            try {
                doc.addImage(fotos[i].data, 'PNG', currentX, currentY, imgWidth, imgHeight);
            } catch (e) {
                console.error('Erro ao adicionar imagem:', e);
            }
            
            currentX += imgWidth + spacing;
            photoCount++;
        }
        
        y = currentY + imgHeight + 8;
    }
    
    if (y + 35 > pageHeight) {
        doc.addPage();
        y = 20;
    }
    
    const signatureWidth = 50;
    const signatureHeight = 25;
    const spacing = (pageWidth - (signatureWidth * 2)) / 3;
    
    if (assinaturas && assinaturas.tecnico) {
        try {
            doc.addImage(assinaturas.tecnico, 'PNG', spacing, y, signatureWidth, signatureHeight);
        } catch (e) {
            console.error('Erro ao adicionar assinatura do técnico:', e);
        }
    }
    
    if (assinaturas && assinaturas.cliente) {
        try {
            doc.addImage(assinaturas.cliente, 'PNG', spacing * 2 + signatureWidth, y, signatureWidth, signatureHeight);
        } catch (e) {
            console.error('Erro ao adicionar assinatura do cliente:', e);
        }
    }
    
    y += signatureHeight + 2;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.line(spacing, y, spacing + signatureWidth, y);
    doc.line(spacing * 2 + signatureWidth, y, spacing * 2 + signatureWidth * 2, y);
    
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('TÉCNICO', spacing + signatureWidth / 2, y + 3, { align: 'center' });
    doc.text('CLIENTE', spacing * 2 + signatureWidth + signatureWidth / 2, y + 3, { align: 'center' });
    
    return doc.output('datauristring');
}

// ======== SINCRONIZAÇÃO PRINCIPAL EM BACKGROUND ========
async function sincronizarFormulariosEmBackground() {
    try {
        console.log('🔄 Iniciando sincronização em background...');
        
        const db = await idb.openDB('FormulariosDB', 4);
        const todosForms = await db.getAll('formularios');
        const pendentes = todosForms.filter(f => !f.sincronizado);
        
        console.log(`📋 Encontrados ${pendentes.length} formulários pendentes`);
        
        if (pendentes.length === 0) {
            console.log('✅ Nenhum formulário pendente para sincronizar');
            return;
        }
        
        for (const form of pendentes) {
            try {
                console.log(`📄 Gerando PDFs para formulário ${form.id}...`);
                
                // Gera os dois PDFs em Base64
                const fichaPDFBase64 = await gerarFichaPDFBase64SW(
                    form.formData, 
                    form.materiais, 
                    form.fotos, 
                    form.assinaturas
                );
                
                const relatorioPDFBase64 = await gerarRelatorioPDFBase64SW(
                    form.formData, 
                    form.materiais, 
                    form.fotos, 
                    form.assinaturas
                );
                
                console.log('✅ PDFs gerados com sucesso');
                
                // Payload com o novo formato
                const payload = {
                    chave: form.chaveUnica,
                    cliente: form.cliente,
                    servico: form.servico,
                    data: form.createdAt,
                    fichaPDF: fichaPDFBase64,
                    relatorioPDF: relatorioPDFBase64
                };
                
                console.log(`📤 Enviando formulário ${form.id} para o servidor...`);
                
                const response = await fetch('https://vps.pesoexato.com/servico_set', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                if (response.ok) {
                    form.sincronizado = true;
                    form.syncedAt = new Date().toISOString();
                    await db.put('formularios', form);
                    console.log(`✅ Formulário ${form.id} sincronizado com sucesso`);
                } else {
                    console.error(`❌ Erro HTTP ao sincronizar ${form.id}: ${response.status}`);
                }
                
            } catch (error) {
                console.error(`❌ Erro ao processar formulário ${form.id}:`, error);
            }
        }
        
        console.log('✅ Sincronização em background concluída');
        
    } catch (error) {
        console.error('❌ Erro crítico no Background Sync:', error);
        throw error; // Permite retry automático do Background Sync
    }
}
