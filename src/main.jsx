import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '../App.jsx'
import '../styles.css'
import { initializeMobileOptimizations } from '../components/MobilePerformance.jsx'

// Silence non-error logs in production unless explicitly enabled via VITE_DEBUG
if (import.meta.env.PROD && import.meta.env.VITE_DEBUG !== 'true') {
  console.log = () => {};
  console.debug = () => {};
  console.info = () => {};
}

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        if (import.meta.env.DEV || import.meta.env.VITE_DEBUG === 'true') {
          console.log('🔧 SW registered: ', registration);
        }
        
        // Check for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New content available, show update notification
              if (window.confirm('New version available! Reload to update?')) {
                window.location.reload();
              }
            }
          });
        });
      })
      .catch((registrationError) => {
        if (import.meta.env.DEV || import.meta.env.VITE_DEBUG === 'true') {
          console.log('❌ SW registration failed: ', registrationError);
        }
      });
  });
}

// Enable app install prompt
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  if (import.meta.env.DEV || import.meta.env.VITE_DEBUG === 'true') {
    console.log('💾 Install prompt available');
  }
  e.preventDefault();
  deferredPrompt = e;
  
  // Show custom install button or notification
  const installEvent = new CustomEvent('showInstallPrompt', { detail: e });
  window.dispatchEvent(installEvent);
});

// Handle app installation
window.addEventListener('appinstalled', (evt) => {
  if (import.meta.env.DEV || import.meta.env.VITE_DEBUG === 'true') {
    console.log('🎉 App installed successfully');
  }
  deferredPrompt = null;
});

// Initialize mobile optimizations
initializeMobileOptimizations();

// Set dynamic viewport height variable for mobile browsers
function setVH() {
  document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
}
setVH();
window.addEventListener('resize', setVH);
window.addEventListener('orientationchange', setVH);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
