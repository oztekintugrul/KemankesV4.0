// js/storage.js - V13.5 (VERİ YÖNETİMİ & NOTLAR)
import { state } from './data.js';

// --- ANA VERİ İŞLEMLERİ ---
export function saveActiveSession() {
    const stateToSave = {
        sessions: state.sessions,
        activeModuleId: state.activeModuleId,
        targetSessionData: state.targetSessionData,
        currentTargetRound: state.currentTargetRound,
        currentTargetFace: state.currentTargetFace
    };
    try {
        localStorage.setItem('kemankes_activeState', JSON.stringify(stateToSave));
    } catch (e) {
        console.warn("Oturum kaydedilemedi (Hafıza Dolu):", e);
    }
}

export function loadActiveSession() {
    try {
        const savedState = localStorage.getItem('kemankes_activeState');
        if (savedState) {
            const parsed = JSON.parse(savedState);
            if(parsed.sessions) Object.assign(state.sessions, parsed.sessions);
            if(parsed.activeModuleId) state.activeModuleId = parsed.activeModuleId;
            if(parsed.targetSessionData) state.targetSessionData = parsed.targetSessionData;
            if(parsed.currentTargetRound) state.currentTargetRound = parsed.currentTargetRound;
            if(parsed.currentTargetFace) state.currentTargetFace = parsed.currentTargetFace;
        }
    } catch (e) { console.error("Oturum yüklenirken hata:", e); }
}

// --- YEDEKLEME VE SIFIRLAMA ---
export function exportData() {
    const data = {};
    // LocalStorage'daki tüm kemankes verilerini topla
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('kemankes')) {
            const value = localStorage.getItem(key);
            try {
                data[key] = JSON.parse(value);
            } catch (e) {
                data[key] = value; // JSON değilse düz string olarak sakla (örn: tema)
            }
        }
    }

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "kemankes_yedek_" + new Date().toISOString().slice(0,10) + ".json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}

export function importData(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            Object.keys(data).forEach(key => {
                if (key.startsWith('kemankes')) {
                    localStorage.setItem(key, JSON.stringify(data[key]));
                }
            });
            alert("Veriler başarıyla yüklendi!");
            location.reload();
        } catch (err) {
            alert("Hata: Geçersiz yedek dosyası.");
            console.error(err);
        }
    };
    reader.readAsText(file);
}

export function hardResetApp() {
    if(confirm("DİKKAT: Tüm verileriniz silinecek ve uygulama sıfırlanacak. Bu işlem geri alınamaz! Emin misiniz?")) {
        localStorage.clear();
        location.reload();
    }
}