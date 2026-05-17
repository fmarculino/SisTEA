const CACHE_NAME = 'sistea-pwa-cache-v1';

// Ativação imediata ao instalar
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Toma controle imediato das abas abertas
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Interceptor de requisições simples
// Permite que o Next.js lide 100% com o controle de cache do lado do cliente/servidor.
// Isso evita conflitos com Server Actions ou atualizações de build, atendendo
// de forma impecável aos critérios de elegibilidade do navegador para instalação do PWA.
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
