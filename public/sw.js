// Service Worker Ofika Livreur : permet l'installation PWA dans Chrome Android tout en
// conservant un passage direct réseau pour les statuts, jetons QR et validations en direct.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
