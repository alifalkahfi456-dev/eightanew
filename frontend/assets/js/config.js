/**
 * Global front-end configuration.
 *
 * IMPORTANT: When you deploy the backend (e.g. to Pterodactyl), update
 * `apiBaseUrl` below to point at it, then redeploy the frontend to Vercel.
 * Example: 'https://api.yourschool.com/api'
 */
window.APP_CONFIG = {
  apiBaseUrl: (function () {
    // Sensible local-development default: same host, port 5000.
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
      return 'http://localhost:5000/api';
    }
    // Change this to your deployed backend URL before going live.
    return 'https://zyroxlegal.rexy-stecu.my.id/api';
  })()
};
