// js/main.js - V13.5 (CACHE BUSTER & LOADER)
import { state } from './data.js';
import * as Logic from './logic.js?v=13.5'; 
import * as Storage from './storage.js?v=13.5';
import * as Weather from './weather.js?v=13.5';
import * as UI from './ui.js?v=13.5';

// Global nesneye bağla ki HTML'deki onclick çalışsın
const App = { ...Logic, ...Storage, ...Weather, ...UI };
Object.assign(window, App);

window.addEventListener('DOMContentLoaded', () => {
    console.log("🏹 Kemankeş Defteri (v4.0) Başlatıldı.");

    // Tema Kontrolü
    const savedTheme = localStorage.getItem('kemankesTheme');
    if (savedTheme === 'light') {
        document.body.classList.add('light-mode');
    }

    // 1. Kayıtlı Oturumu Geri Yükle
    if (Storage.loadActiveSession) {
        Storage.loadActiveSession();
    }

    // 2. Ekranı Açık Tut (Wake Lock)
    let wakeLock = null;
    const requestWakeLock = async () => {
        if ('wakeLock' in navigator && document.visibilityState === 'visible') {
            try { wakeLock = await navigator.wakeLock.request('screen'); } catch (err) { console.log('Wake Lock error:', err); }
        }
    };
    requestWakeLock();
    document.addEventListener('visibilitychange', async () => {
        if (wakeLock !== null && document.visibilityState === 'visible') await requestWakeLock();
    });

    // Başlangıç Modülü (Zamanlamayı Garantiye Al)
    setTimeout(() => {
        if (window.switchModule) {
            // Kayıtlı son modülü aç, yoksa 18m varsayılan
            window.switchModule(state.activeModuleId || '18m');
        } else {
            console.error("⚠️ switchModule yüklenemedi. Sayfayı yenileyin.");
        }
    }, 200);
});