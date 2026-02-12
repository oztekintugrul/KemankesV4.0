// Modül Ayarları
const moduleConfigs = {
    '18m': { name: '18m Salon Müsabaka', rounds: 7, arrowsPerRound: 5, inputType: 'round_18m' },
    '70m': { name: '70m Açık Hava (Puta)', rounds: 7, arrowsPerRound: 9, inputType: 'round' }
};

// Aktif Oturum Verileri (Her modül için ayrı durum saklar)
const sessions = {
    '18m': createSessionState(7),
    '70m': createSessionState(12)
};

// Hedef Analizi Verileri
let targetSessionData = Array(7).fill(null).map(() => []); // 7 turluk veri
let targetPoints = targetSessionData[0]; // Şu anki turun puanları (referans)
let currentTargetRound = 1;
let currentTargetFace = '18m';

// Hedef Ayarları (Resim ve Ok Sayısı)
const targetConfigs = {
    '18m': { image: 'puta_kafa_18.png', arrowCount: 5 },
    '70m': { image: 'puta_70.png', arrowCount: 6 },
    '50m': { image: 'puta_kafa_kalkan.png', arrowCount: 6 }
};

let activeModuleId = '18m';

function createSessionState(roundCount) {
    return {
        score: 0,
        totalArrows: 0,
        currentRound: 1,
        arrowsInRound: 0,
        roundScores: new Array(roundCount).fill(0),
        isFinished: false,
        shotHistory: [],
        arrowStats: {}, // { 'OkLabel': { hits: 0, shots: 0 } }
        arrowLabels: [], // Varsayılan boş (1,2,3... otomatik atanır)
        // UI Durumunu da saklayalım (Sayfa yenilenirse butonlar seçili kalsın)
        uiState: {
            arrowStates18m: [0, 0, 0, 0, 0],
            selectedArrows70m: []
        }
    };
}

// Uygulama açıldığında kayıtlı geçmişi yükle
document.addEventListener('DOMContentLoaded', () => {
    // 1. Önce kayıtlı aktif oturumu geri yükle (Varsa)
    loadActiveSession();
    
    loadHistoryUI();
    renderUI(); // İlk açılışta UI oluştur
    requestWakeLock();
    generateArrowSelectorButtons('K'); // Varsayılan 18m (K)
    
    // Başlangıçta aktif modülün etiketlerini yükle
    const session = sessions[activeModuleId];
    currentArrowLabels = session.arrowLabels;
    
    // Modül butonlarını güncelle (loadActiveSession activeModuleId'yi değiştirmiş olabilir)
    switchModule(activeModuleId, false); // false: render tekrarı yapma

    renderArrowSelector();

    // Temayı yükle
    const savedTheme = localStorage.getItem('kemankesTheme');
    if (savedTheme === 'light') {
        document.body.classList.add('light-mode');
    }
});

// --- VERİ KALICILIĞI (PERSISTENCE) ---
function saveActiveSession() {
    const stateToSave = {
        sessions: sessions,
        activeModuleId: activeModuleId,
        targetSessionData: targetSessionData,
        currentTargetRound: currentTargetRound,
        currentTargetFace: currentTargetFace
    };
    localStorage.setItem('kemankes_activeState', JSON.stringify(stateToSave));
}

function loadActiveSession() {
    try {
        const savedState = localStorage.getItem('kemankes_activeState');
        if (savedState) {
            const parsed = JSON.parse(savedState);
            
            // Verileri geri yükle
            if(parsed.sessions) Object.assign(sessions, parsed.sessions);
            if(parsed.activeModuleId) activeModuleId = parsed.activeModuleId;
            if(parsed.targetSessionData) targetSessionData = parsed.targetSessionData;
            if(parsed.currentTargetRound) currentTargetRound = parsed.currentTargetRound;
            if(parsed.currentTargetFace) currentTargetFace = parsed.currentTargetFace;
            
            // Hedef analizi referansını güncelle
            if (targetSessionData && targetSessionData.length >= currentTargetRound) {
                targetPoints = targetSessionData[currentTargetRound - 1];
            }
        }
    } catch (e) {
        console.error("Oturum yüklenirken hata:", e);
        // Hata durumunda varsayılanlarla devam et
    }
}

// Ekranın kapanmasını engelle (Wake Lock API)
let wakeLock = null;
async function requestWakeLock() {
    if ('wakeLock' in navigator) {
        try {
            wakeLock = await navigator.wakeLock.request('screen');
        } catch (err) {
            console.log('Wake Lock error:', err);
        }
    }
}
document.addEventListener('visibilitychange', async () => {
    if (wakeLock !== null && document.visibilityState === 'visible') {
        await requestWakeLock();
    }
});

function loadHistoryUI() {
    const savedHistory = JSON.parse(localStorage.getItem('kemankesHistory_' + activeModuleId)) || [];
    const list = document.getElementById('historyList');
    list.innerHTML = ''; // Listeyi temizle
    savedHistory.forEach(item => {
        const newItem = document.createElement('div');
        newItem.className = 'history-item';
        // Eski kayıtlarda date olmayabilir, kontrol et
        const dateDisplay = item.date ? item.date : "Tarihsiz";
        const avg = item.arrows > 0 ? (item.score / item.arrows).toFixed(2) : "0.00";

        newItem.innerHTML = `
            <div>
                <div style="color:#d4af37">${dateDisplay} ${item.time}</div>
                <div style="font-size:12px; color:#888;">Ort: ${avg} (${item.arrows} ok)</div>
            </div>
            <div style="display:flex; align-items:center;">
                <span style="font-weight:bold;">${item.score} Puan</span>
                <button class="btn-delete-record" onclick="deleteHistoryItem('${activeModuleId}', ${savedHistory.indexOf(item)})">Sil</button>
            </div>
        `;
        list.appendChild(newItem);
    });
}

// Modül Değiştirme
function switchModule(moduleId, shouldRender = true) {
    activeModuleId = moduleId;
    saveActiveSession(); // Modül değişimini kaydet
    
    // Menü butonlarını güncelle
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    toggleRightSidebar(false); // Modül değişince sağ menüyü kapat
    
    // Arşiv butonu özel durum
    if(moduleId === 'archive') {
        document.getElementById('btn-archive').classList.add('active');
        renderArchive('18m'); // Varsayılan olarak 18m grafiğini aç
    } else if (moduleId === 'target') {
        document.getElementById('btn-target').classList.add('active');
        loadTargetHistoryUI();
        // Buton durumunu güncelle (resim değişmez, sadece buton aktifliği)
        switchTargetFace(currentTargetFace, null, false); // false: active class resetleme
        switchTargetRound(currentTargetRound); // Ekranı ve noktaları yenile
        injectTargetResetButton();
    } else if (moduleId === 'analysis') {
        document.getElementById('btn-analysis').classList.add('active');
        renderArrowAnalysis('18m'); // Varsayılan 18m
    } else if (moduleId === 'notes') {
        document.getElementById('btn-notes').classList.add('active');
        renderNotes();
    } else if (moduleId === 'settings') {
        document.getElementById('btn-settings').classList.add('active');
        // Settings için özel bir render fonksiyonuna gerek yok şimdilik
    } else {
        document.getElementById('btn-' + moduleId).classList.add('active');
        updateKeypad(moduleId);
        
        // Modüle göre ok seçici butonlarını oluştur
        if (moduleId === '18m') generateArrowSelectorButtons('K');
        if (moduleId === '70m') generateArrowSelectorButtons('B');

        // Modüle özel ok grubunu yükle
        const session = sessions[moduleId];
        currentArrowLabels = session.arrowLabels;
        renderArrowSelector();

        if(shouldRender) {
            loadHistoryUI();
            renderUI();
        }
    }
    
    // Modül görünürlüğünü ayarla
    document.querySelectorAll('.module').forEach(el => el.classList.remove('active'));
    
    // Hava Durumu Butonu Sadece 70m'de görünsün
    const btnWeather = document.getElementById('btnWeather');
    if (btnWeather) {
        btnWeather.style.display = (moduleId === '70m') ? 'block' : 'none';
    }

    if(moduleId === 'archive') {
        document.getElementById('module-archive').classList.add('active');
    } else if (moduleId === 'target') {
        document.getElementById('module-target').classList.add('active');
    } else if (moduleId === 'notes') {
        document.getElementById('module-notes').classList.add('active');
    } else if (moduleId === 'settings') {
        document.getElementById('module-settings').classList.add('active');
    } else if (moduleId === 'analysis') {
        document.getElementById('module-analysis').classList.add('active');
    } else {
        document.getElementById('game-interface').classList.add('active');
    }
}

function getButtonStyle18m(state) {
    if (state === 0) {
        return { style: 'background-color: #333; color: #fff; border-color: #444;', text: '<span style="font-size:10px; color:#888;">(Miss)</span>' };
    } else if (state === 1) {
        return { style: 'background-color: #e0e0e0; color: #000; border-color: #fff;', text: '<span style="font-size:10px; color:#000;">(Hit - 1)</span>' };
    } else if (state === 3) {
        return { style: 'background-color: #d4af37; color: #000; border-color: #b5952f;', text: '<span style="font-size:10px; color:#000;">(HeadShot - 3)</span>' };
    }
    return { style: '', text: '' };
}

function updateKeypad(moduleId) {
    const keypad = document.getElementById('keypad');
    const config = moduleConfigs[moduleId];
    const session = sessions[moduleId];
    
    keypad.innerHTML = '';
    keypad.className = 'keypad'; // Sınıfları sıfırla

    if (config.inputType === 'shot') {
        // 18m Klasik Tuşlar (Tek tek giriş) - Eski haline getirildi
        keypad.classList.add('numeric');
        let buttonsHTML = '';
        const scores = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0];
        scores.forEach(score => {
            let label = score === 0 ? "M" : score;
            let style = score === 10 ? "background-color: #d4af37; color: #000; font-weight:bold;" : "";
            buttonsHTML += `<button onclick="addScore(${score})" style="${style}">${label}</button>`;
        });
        
        buttonsHTML += `<button class="btn-undo" onclick="undoLastShot()">Sil</button>`;
        buttonsHTML += `<button class="btn-reset" onclick="resetScore()">Sıfırla</button>`;
        keypad.innerHTML = buttonsHTML;
    } else if (config.inputType === 'round_18m') {
        // 18m Yeni Tuşlar (70m mantığıyla)
        keypad.classList.add('numeric');
        let buttonsHTML = '';

        // Ok sayısı kadar buton oluştur (1-5)
        for(let i=1; i<=config.arrowsPerRound; i++) {
            const label = getArrowLabel(i-1);
            // Kayıtlı UI durumunu kontrol et
            const savedState = session.uiState.arrowStates18m[i-1] || 0;
            const btnStyle = getButtonStyle18m(savedState);
            buttonsHTML += `<button id="arrowBtn18m_${i-1}" onclick="toggleArrow18m(${i-1})" style="${btnStyle.style}">${label}<br>${btnStyle.text}</button>`;
        }

        buttonsHTML += `<button class="btn-reset" onclick="submitRound18m()">Kaydet & İlerle</button>`;
        buttonsHTML += `<button class="btn-undo" onclick="undoLastShot()">Sil</button>`;
        buttonsHTML += `<button class="btn-reset" onclick="resetScore()">Sıfırla & Kaydet</button>`;
        
        keypad.innerHTML = buttonsHTML;
    } else if (config.inputType === 'round') {
        // 70m Numerik Tuşlar (0-9)
        keypad.classList.add('numeric');
        
        // 70m için Ok Seçim Arayüzü
        let buttonsHTML = '';
        
        // Ok sayısı kadar buton oluştur (1-9)
        for(let i=1; i<=config.arrowsPerRound; i++) {
            // Etiketi bul
            const label = getArrowLabel(i-1);
            // Kayıtlı UI durumunu kontrol et
            const isSelected = session.uiState.selectedArrows70m.includes(i-1);
            const btnStyle = isSelected 
                ? 'background-color: #d4af37; color: #000;' 
                : 'background-color: #333; color: #fff;';
            const subText = isSelected 
                ? '<span style="font-size:10px; color:#000;">(Hit)</span>' 
                : '<span style="font-size:10px; color:#888;">(Miss)</span>';
                
            buttonsHTML += `<button id="arrowBtn70m_${i-1}" onclick="toggleArrow70m(${i-1})" style="font-size:14px; padding:10px; ${btnStyle}">${label}<br>${subText}</button>`;
        }

        buttonsHTML += `<button class="btn-reset" onclick="submitRound70m()" style="grid-column: span 3;">Kaydet & İlerle</button>`;
        buttonsHTML += `<button class="btn-reset" onclick="resetScore()" style="grid-column: span 3; background-color:#333;">Sıfırla & Kaydet</button>`;
        buttonsHTML += `<div style="grid-column: span 3; text-align: center; color: #666; font-size: 12px; margin: 5px 0;">-------- hızlı giriş --------</div>`;
        buttonsHTML += `<button class="btn-undo" onclick="undoLastShot()" style="grid-column: span 3; padding:10px; font-size:16px;">Sil</button>`;

        // 7-8-9, 4-5-6, 1-2-3 sırası
        [7,8,9,4,5,6,1,2,3].forEach(num => {
            buttonsHTML += `<button onclick="addScore(${num})" style="padding:10px; font-size:18px;">${num}</button>`;
        });
        
        buttonsHTML += `<button onclick="addScore(0)" style="grid-column: 2; padding:10px; font-size:18px;">0</button>`;
        keypad.innerHTML = buttonsHTML;
    }
}

function getArrowLabel(index) {
    return (currentArrowLabels[index] || (index + 1).toString());
}

// Puan Ekleme
function addScore(points) {
    const session = sessions[activeModuleId];
    const config = moduleConfigs[activeModuleId];

    if (session.isFinished) {
        alert("Antrenman bitti! Lütfen kaydedip sıfırlayın.");
        return;
    }

    if (config.inputType === 'shot') {
        // Tek tek ok girişi (18m)
        const arrowIndex = session.arrowsInRound;
        const label = getArrowLabel(arrowIndex);
        const isHit = points > 0;

        session.score += points;
        session.shotHistory.push({ points: points, label: label, isHit: isHit });
        session.totalArrows++;
        session.roundScores[session.currentRound - 1] += points;
        session.arrowsInRound++;

        // İstatistik Güncelle
        updateArrowStats(label, isHit, 1, points);

    } else {
        // Toplu tur girişi (70m ve 18m)
        let roundScore = 0;
        let historyData = {};

        if (config.inputType === 'round_18m') {
            // 18m Logic
            roundScore = points.score;
            historyData = { score: roundScore, detailedShots: points.detailedShots };
            
            // Stats
            points.detailedShots.forEach(shot => {
                updateArrowStats(shot.label, shot.score > 0, 1, shot.score);
            });
        } else {
            // 70m Logic
            const hitCount = typeof points === 'object' ? points.hitCount : points;
            const hitLabels = typeof points === 'object' ? points.hitLabels : [];
            roundScore = hitCount * 1;
            historyData = { score: roundScore, hitLabels: hitLabels };
            
            // Stats
            for(let i=0; i<config.arrowsPerRound; i++) {
                const label = getArrowLabel(i);
                const isHit = hitLabels.includes(label);
                updateArrowStats(label, isHit, 1, isHit ? 1 : 0);
            }
        }
        
        session.score += roundScore;
        session.shotHistory.push(historyData); // Geçmişe detaylı ekle
        session.totalArrows += config.arrowsPerRound; // 9 ok eklendi
        
        // Turu direkt doldur
        session.roundScores[session.currentRound - 1] = roundScore;
        session.arrowsInRound = config.arrowsPerRound;
    }

    // UI Güncellemeleri
    renderUI();

    // Tur Kontrolü
    if (session.arrowsInRound >= config.arrowsPerRound) {
        if (session.currentRound < config.rounds) {
            session.currentRound++;
            session.arrowsInRound = 0;
            
            // Numerik modda yeni tura geçince UI'da hemen göster
            renderUI(); 
        } else {
            session.isFinished = true;
            setTimeout(() => alert(`Tebrikler! ${config.name} tamamlandı.`), 100);
            renderUI(); // Bitiş durumunu göstermek için
        }
    }
}

// İstatistik Yardımcısı
function updateArrowStats(label, isHit, shotCount, points = 0) {
    const session = sessions[activeModuleId];
    if (!session.arrowStats[label]) {
        session.arrowStats[label] = { hits: 0, shots: 0, totalScore: 0, headShots: 0 };
    }
    session.arrowStats[label].shots += shotCount;
    if (isHit) session.arrowStats[label].hits += shotCount;
    
    // Puan ve HeadShot takibi
    session.arrowStats[label].totalScore = (session.arrowStats[label].totalScore || 0) + (points * shotCount);
    if (points === 3) session.arrowStats[label].headShots = (session.arrowStats[label].headShots || 0) + shotCount;
}

// 18m Mantığı
let arrowStates18m = [0, 0, 0, 0, 0]; // 0: Miss, 1: Hit, 3: HeadShot

function toggleArrow18m(index) {
    if (currentArrowLabels.length === 0) {
        const btn = document.getElementById('btnArrowSelect');
        if(btn) {
            btn.style.animation = "pulse-red 1s infinite";
            setTimeout(() => btn.style.animation = "", 2000);
        }
    }
    const btn = document.getElementById(`arrowBtn18m_${index}`);
    
    // Cycle: 0 -> 1 -> 3 -> 0
    let state = arrowStates18m[index];
    if (state === 0) state = 1;
    else if (state === 1) state = 3;
    else state = 0;
    
    arrowStates18m[index] = state;
    
    // Session'a kaydet (Bu fonksiyon eksikti, buraya ekledik)
    const session = sessions['18m'];
    session.uiState.arrowStates18m[index] = state;
    saveActiveSession(); 
    
    // Update Visuals
    const styleData = getButtonStyle18m(state);
    btn.style = styleData.style;
    btn.innerHTML = `${getArrowLabel(index)}<br>${styleData.text}`;
}

function submitRound18m() {
    if (currentArrowLabels.length === 0) {
        if (!confirm("⚠️ Henüz ok grubu seçmediniz!\n\nİstatistiklerinizde ok takibi yapabilmek için oklarınızı seçmeniz önerilir.\n\nSeçim yapmadan devam etmek istiyor musunuz?")) {
            toggleRightSidebar(true);
            return;
        }
    }

    let totalScore = 0;
    let detailedShots = [];
    
    arrowStates18m.forEach((state, index) => {
        totalScore += state;
        detailedShots.push({
            label: getArrowLabel(index),
            score: state
        });
    });
    
    addScore({ score: totalScore, detailedShots: detailedShots });
    
    // Reset
    arrowStates18m = [0, 0, 0, 0, 0];
    const session = sessions['18m'];
    session.uiState.arrowStates18m = [0, 0, 0, 0, 0];
    saveActiveSession();

    // Reset buttons manually
    for(let i=0; i<5; i++) {
        const btn = document.getElementById(`arrowBtn18m_${i}`);
        if(btn) {
            const styleData = getButtonStyle18m(0);
            btn.style = styleData.style;
            btn.innerHTML = `${getArrowLabel(i)}<br>${styleData.text}`;
        }
    }
}

// 70m Mantığı
let selectedArrows70m = []; // Indexleri tutar

function toggleArrow70m(index) {
    if (currentArrowLabels.length === 0) {
        const btn = document.getElementById('btnArrowSelect');
        if(btn) {
            btn.style.animation = "pulse-red 1s infinite";
            setTimeout(() => btn.style.animation = "", 2000);
        }
    }
    const btn = document.getElementById(`arrowBtn70m_${index}`);
    const idx = selectedArrows70m.indexOf(index);
    
    if (idx === -1) {
        selectedArrows70m.push(index);
        btn.style.backgroundColor = '#d4af37';
        btn.style.color = '#000';
        btn.querySelector('span').innerText = '(Hit)';
        btn.querySelector('span').style.color = '#000';
    } else {
        selectedArrows70m.splice(idx, 1);
        btn.style.backgroundColor = '#333';
        btn.style.color = '#fff';
        btn.querySelector('span').innerText = '(Miss)';
        btn.querySelector('span').style.color = '#888';
    }
    
    // Session Güncelleme
    const session = sessions['70m'];
    session.uiState.selectedArrows70m = selectedArrows70m;
    saveActiveSession();
}

function submitRound70m() {
    if (currentArrowLabels.length === 0) {
        if (!confirm("⚠️ Henüz ok grubu seçmediniz!\n\nİstatistiklerinizde ok takibi yapabilmek için oklarınızı seçmeniz önerilir.\n\nSeçim yapmadan devam etmek istiyor musunuz?")) {
            toggleRightSidebar(true);
            return;
        }
    }

    const hitCount = selectedArrows70m.length;
    const hitLabels = selectedArrows70m.map(idx => getArrowLabel(idx));
    
    addScore({ hitCount: hitCount, hitLabels: hitLabels });
    
    // Seçimleri sıfırla
    selectedArrows70m = [];
    const session = sessions['70m'];
    session.uiState.selectedArrows70m = [];
    saveActiveSession();
    
    // Butonları resetle (UI renderUI ile yenilenecek ama keypad statik kalabilir, manuel reset gerekebilir)
    const config = moduleConfigs['70m'];
    for(let i=0; i<config.arrowsPerRound; i++) {
        const btn = document.getElementById(`arrowBtn70m_${i}`);
        if(btn) {
            btn.style.backgroundColor = '#333';
            btn.style.color = '#fff';
            btn.querySelector('span').innerText = '(Miss)';
            btn.querySelector('span').style.color = '#888';
        }
    }
}

// Son atışı geri al
function undoLastShot() {
    const session = sessions[activeModuleId];
    const config = moduleConfigs[activeModuleId];

    if (session.shotHistory.length === 0) return;

    const lastData = session.shotHistory.pop();
    
    // Eğer tur bitmişse veya yeni tura geçilmişse geri sar
    if (session.isFinished) {
        session.isFinished = false;
    } 
    
    // Geri alma mantığı
    if (config.inputType === 'shot') {
        if (session.arrowsInRound === 0 && session.currentRound > 1) {
            session.currentRound--;
            session.arrowsInRound = config.arrowsPerRound;
        }
        session.totalArrows--;
        session.arrowsInRound--;
        
        // İstatistik Geri Al (18m)
        session.score -= lastData.points;
        updateArrowStats(lastData.label, lastData.isHit, -1);
        
        // Puanı sil
        session.roundScores[session.currentRound - 1] = Math.max(0, session.roundScores[session.currentRound - 1] - lastData.points);

    } else {
        // Round modunda (70m) bir önceki tura dön ve sıfırla
        session.currentRound--;
        session.arrowsInRound = 0;
        session.totalArrows -= config.arrowsPerRound;

        session.score -= lastData.score;
        session.roundScores[session.currentRound - 1] = 0;
        
        if (config.inputType === 'round_18m') {
            // İstatistik Geri Al (18m)
            if (lastData.detailedShots) {
                lastData.detailedShots.forEach(shot => {
                    updateArrowStats(shot.label, shot.score > 0, -1, shot.score);
                });
            }
        } else {
            // İstatistik Geri Al (70m)
            // Tüm okların istatistiğini geri al
            for(let i=0; i<config.arrowsPerRound; i++) {
                const label = getArrowLabel(i);
                const isHit = lastData.hitLabels.includes(label);
                updateArrowStats(label, isHit, -1, isHit ? 1 : 0);
            }
        }
    }

    renderUI();
}

function renderUI() {
    const session = sessions[activeModuleId];
    const config = moduleConfigs[activeModuleId];

    // Başlık ve Skor
    document.getElementById('moduleTitle').innerText = config.name;
    document.getElementById('totalScore').innerText = session.score;
    document.getElementById('turDisplay').innerText = session.currentRound;
    document.getElementById('okDisplay').innerText = session.arrowsInRound + "/" + config.arrowsPerRound;
    
    // 18m için sıradaki oku göster (Opsiyonel UX)
    if (config.inputType === 'shot' && !session.isFinished) {
        // document.getElementById('gameArrowGroup').placeholder = `Sıradaki: Ok ${getArrowLabel(session.arrowsInRound)}`;
    }

    // Grid güncelleme
    const grid = document.getElementById('roundsGrid');
    grid.innerHTML = ''; // Grid'i temizle ve yeniden oluştur
    
    // Grid sütun ayarı (70m için 6 sütun, 18m için 7 sütun)
    grid.style.gridTemplateColumns = `repeat(${activeModuleId === '70m' ? 6 : 7}, 1fr)`;

    for (let i = 0; i < config.rounds; i++) {
        const cell = document.createElement('div');
        cell.className = 'round-cell';
        
        // Aktif turu işaretle
        if (i + 1 === session.currentRound && !session.isFinished) {
            cell.classList.add('active');
        }

        const numSpan = document.createElement('span');
        numSpan.className = 'round-num';
        numSpan.innerText = i + 1;

        const scoreSpan = document.createElement('span');
        scoreSpan.className = 'round-score';

        // Puanları yaz
        if (i < session.currentRound - 1 || (session.isFinished) || (i === session.currentRound - 1 && session.arrowsInRound > 0)) {
            scoreSpan.innerText = session.roundScores[i];
        } else if (i === session.currentRound - 1 && session.arrowsInRound === 0) {
             scoreSpan.innerText = "0";
        } else {
            scoreSpan.innerText = "-";
        }

        cell.appendChild(numSpan);
        cell.appendChild(scoreSpan);
        grid.appendChild(cell);
    }
}

// Sıfırlama ve Listeye Ekleme
function resetScore() {
    const session = sessions[activeModuleId];
    const config = moduleConfigs[activeModuleId];

    if (session.totalArrows === 0) return;

    const list = document.getElementById('historyList');
    const newItem = document.createElement('div');
    newItem.className = 'history-item';
    
    // Tarih saat bilgisi
    const now = new Date();
    const timeString = now.getHours() + ":" + String(now.getMinutes()).padStart(2, '0');
    const dateString = now.toLocaleDateString('tr-TR'); // Gün.Ay.Yıl formatı

    newItem.innerHTML = `<span>Saat ${timeString}</span> <span>${session.totalArrows} ok / ${session.score} puan</span>`;
    
    // En başa ekle
    list.insertBefore(newItem, list.firstChild);
    
    // Ekstra Bilgi İste
    const note = prompt("Antrenman Notu (Ok Grubu, Yıldız Ok vb.):") || "";

    // LocalStorage'a Kaydet
    const historyItem = { date: dateString, fullDate: now.toISOString(), time: timeString, arrows: session.totalArrows, score: session.score, note: note };
    const storageKey = 'kemankesHistory_' + activeModuleId;
    const savedHistory = JSON.parse(localStorage.getItem(storageKey)) || [];
    
    // --- REKOR KONTROLÜ ---
    let currentMax = 0;
    if (savedHistory.length > 0) {
        currentMax = Math.max(...savedHistory.map(h => h.score));
    }
    
    if (session.score > currentMax && session.score > 0) {
        triggerCelebration(session.score);
    }
    // ----------------------

    savedHistory.unshift(historyItem);
    localStorage.setItem(storageKey, JSON.stringify(savedHistory));

    // Global İstatistikleri Güncelle (Biriktir)
    const globalStatsKey = 'kemankesGlobalStats_' + activeModuleId;
    const globalStats = JSON.parse(localStorage.getItem(globalStatsKey)) || {};
    const currentStats = sessions[activeModuleId].arrowStats;

    Object.keys(currentStats).forEach(label => {
        if (!globalStats[label]) {
            globalStats[label] = { hits: 0, shots: 0, totalScore: 0, headShots: 0 };
        }
        globalStats[label].hits += currentStats[label].hits;
        globalStats[label].shots += currentStats[label].shots;
        globalStats[label].totalScore = (globalStats[label].totalScore || 0) + (currentStats[label].totalScore || 0);
        globalStats[label].headShots = (globalStats[label].headShots || 0) + (currentStats[label].headShots || 0);
        if (currentStats[label].shots > 0) {
            globalStats[label].sessions = (globalStats[label].sessions || 0) + 1;
        }
    });
    localStorage.setItem(globalStatsKey, JSON.stringify(globalStats));

    // Ok etiketlerini koru (Sıfırlamadan etkilenmesin)
    const savedLabels = sessions[activeModuleId].arrowLabels;

    // Oturumu sıfırla
    sessions[activeModuleId] = createSessionState(config.rounds);
    sessions[activeModuleId].arrowLabels = savedLabels; // Geri yükle
    
    renderUI();
}

function triggerCelebration(score) {
    const overlay = document.getElementById('celebration-overlay');
    const scoreDisplay = document.getElementById('record-score-display');
    scoreDisplay.innerText = score;
    overlay.style.display = 'flex';

    // Konfeti Efekti
    const colors = ['#d4af37', '#f44336', '#2196f3', '#4caf50', '#ffeb3b'];
    
    for (let i = 0; i < 100; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.left = Math.random() * 100 + 'vw';
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.animation = `fall ${Math.random() * 3 + 2}s linear forwards`;
        confetti.style.opacity = Math.random();
        
        // Rastgele düşüş animasyonu ekle (JS ile style sheet'e eklemek yerine inline basit çözüm)
        confetti.animate([
            { transform: `translate(0, 0) rotate(0deg)`, opacity: 1 },
            { transform: `translate(${Math.random()*100 - 50}px, 100vh) rotate(${Math.random()*720}deg)`, opacity: 0 }
        ], {
            duration: Math.random() * 2000 + 2000,
            easing: 'linear',
            fill: 'forwards'
        });
        
        overlay.appendChild(confetti);
    }

    // 4 saniye sonra kapat
    setTimeout(() => {
        overlay.style.display = 'none';
        overlay.innerHTML = `<div class="record-card"><div class="record-title">🏆 YENİ REKOR! 🏆</div><div class="record-score" id="record-score-display">${score}</div></div>`; // Temizle
    }, 4000);
}

// --- OK GRUBU VE İSTATİSTİK ---
let currentArrowLabels = [];
let isBrokenMode = false;

function generateArrowSelectorButtons(prefix) {
    const sidebar = document.getElementById('arrowSelectorSidebar');
    sidebar.innerHTML = '';

    // --- KONTROL BUTONLARI (YENİ) ---
    const controlsDiv = document.createElement('div');
    controlsDiv.style.display = 'flex';
    controlsDiv.style.flexDirection = 'column';
    controlsDiv.style.gap = '8px';
    controlsDiv.style.marginBottom = '15px';
    controlsDiv.style.width = '100%';
    controlsDiv.style.alignItems = 'center';
    controlsDiv.style.borderBottom = '1px solid #333';
    controlsDiv.style.paddingBottom = '10px';

    // Seçimi Sıfırla Butonu
    const btnClear = document.createElement('button');
    btnClear.className = 'arrow-select-btn';
    btnClear.style.borderRadius = '8px';
    btnClear.style.width = '90%';
    btnClear.style.fontSize = '12px';
    btnClear.style.backgroundColor = '#8b0000'; // Kırmızı
    btnClear.innerText = 'Seçimi Sıfırla';
    btnClear.onclick = clearArrowSelection;
    controlsDiv.appendChild(btnClear);

    // Kırık Ok Modu Butonu
    const btnBroken = document.createElement('button');
    btnBroken.id = 'btnBrokenMode';
    btnBroken.className = 'arrow-select-btn';
    btnBroken.style.borderRadius = '8px';
    btnBroken.style.width = '90%';
    btnBroken.style.fontSize = '12px';
    btnBroken.style.backgroundColor = '#333';
    btnBroken.innerText = '🛠️ Kırıldı';
    btnBroken.onclick = toggleBrokenMode;
    controlsDiv.appendChild(btnBroken);

    sidebar.appendChild(controlsDiv);
    // --------------------------------

    for(let i=1; i<=25; i++) {
        const btn = document.createElement('button');
        btn.className = 'arrow-select-btn';
        btn.id = `arrow-sel-${prefix}${i}`;
        btn.innerText = `${prefix}${i}`;
        btn.onclick = () => toggleArrowSelector(`${prefix}${i}`);
        sidebar.appendChild(btn);
    }
}

function toggleRightSidebar(forceState) {
    const sidebar = document.getElementById('arrowSelectorSidebar');
    if (typeof forceState === 'boolean') {
        if (forceState) sidebar.classList.add('show');
        else sidebar.classList.remove('show');
    } else {
        sidebar.classList.toggle('show');
    }
}

function toggleBrokenMode() {
    isBrokenMode = !isBrokenMode;
    const btn = document.getElementById('btnBrokenMode');
    if(isBrokenMode) {
        btn.style.backgroundColor = '#d4af37';
        btn.style.color = 'black';
        btn.style.fontWeight = 'bold';
        alert("🛠️ KIRIK OK MODU AKTİF\n\nŞimdi listeden kırılan veya yenilediğiniz okun üzerine tıklayın.\nBu işlem o okun tüm istatistiklerini sıfırlayacaktır.");
    } else {
        btn.style.backgroundColor = '#333';
        btn.style.color = 'white';
        btn.style.fontWeight = 'normal';
    }
}

function handleBrokenArrow(label) {
    if(confirm(`⚠️ DİKKAT: ${label} numaralı okun tüm istatistikleri ve geçmiş verileri SIFIRLANACAK.\n\nBu numaraya sahip yeni bir ok yaptıysanız bu işlemi onaylayın.\n\nOnaylıyor musunuz?`)) {
        // 1. Global İstatistikleri Sıfırla
        const globalKey = 'kemankesGlobalStats_' + activeModuleId;
        const globalStats = JSON.parse(localStorage.getItem(globalKey)) || {};
        if(globalStats[label]) {
            delete globalStats[label];
            localStorage.setItem(globalKey, JSON.stringify(globalStats));
        }

        // 2. Aktif Oturum İstatistiklerini Sıfırla
        const session = sessions[activeModuleId];
        if(session.arrowStats[label]) {
            delete session.arrowStats[label];
        }

        alert(`${label} verileri başarıyla sıfırlandı. Artık yeni bir ok olarak işlem görecek.`);
        toggleBrokenMode(); // Modu kapat
        
        // Eğer analiz sayfası açıksa yenile
        if(activeModuleId === 'analysis') {
             renderArrowAnalysis(currentAnalysisType);
        }
    }
}

function clearArrowSelection() {
    if(confirm("Seçili ok listesi tamamen temizlensin mi?")) {
        sessions[activeModuleId].arrowLabels = [];
        currentArrowLabels = [];
        renderArrowSelector();
        if (activeModuleId === '70m') updateKeypad('70m');
        if (activeModuleId === '18m') {
            renderUI();
            updateKeypad('18m');
        }
        toggleRightSidebar(false);
    }
}

function toggleArrowSelector(label) {
    if (isBrokenMode) {
        handleBrokenArrow(label);
        return;
    }

    const session = sessions[activeModuleId];
    const config = moduleConfigs[activeModuleId];
    const limit = config.arrowsPerRound;
    let labels = session.arrowLabels;

    const idx = labels.indexOf(label);

    if (idx > -1) {
        labels.splice(idx, 1); // Çıkar
    } else {
        if (labels.length < limit) {
            labels.push(label); // Ekle
        }
    }
    
    // Sırala (Prefix'i atıp sayıya göre)
    labels.sort((a, b) => {
        const numA = parseInt(a.replace(/^\D+/g, ''));
        const numB = parseInt(b.replace(/^\D+/g, ''));
        return numA - numB;
    });
    
    session.arrowLabels = labels;
    currentArrowLabels = labels;
    
    renderArrowSelector();
    
    if (activeModuleId === '70m') {
        updateKeypad('70m');
    }
    if (activeModuleId === '18m') {
        renderUI();
        updateKeypad('18m'); // 18m butonlarını güncelle
    }

    // Limit dolduysa menüyü kapat
    if (labels.length >= limit) {
        toggleRightSidebar(false);
    }
}

function renderArrowSelector() {
    const session = sessions[activeModuleId];
    const labels = session.arrowLabels;
    const prefix = activeModuleId === '18m' ? 'K' : 'B';

    const btnSelect = document.getElementById('btnArrowSelect');
    if (btnSelect) {
        if (labels.length === 0) {
            btnSelect.innerHTML = "⚠️ Ok Seçiniz";
            btnSelect.style.borderColor = "#f44336";
            btnSelect.style.color = "#f44336";
        } else {
            btnSelect.innerHTML = "🏹 Ok Seç";
            btnSelect.style.borderColor = "";
            btnSelect.style.color = "";
        }
    }

    for (let i = 1; i <= 25; i++) {
        const btn = document.getElementById(`arrow-sel-${prefix}${i}`);
        if (btn) {
            if (labels.includes(`${prefix}${i}`)) {
                btn.classList.add('selected');
            } else {
                btn.classList.remove('selected');
            }
        }
    }
}

function showMatchStats() {
    const session = sessions[activeModuleId];
    const stats = session.arrowStats;
    const content = document.getElementById('statsContent');
    
    if (Object.keys(stats).length === 0) {
        content.innerHTML = "<p>Henüz veri yok.</p>";
    } else {
        let html = '';
        
        if (activeModuleId === '18m') {
            html = `<table class="stats-table"><thead><tr><th>Ok</th><th>Kafa</th><th>Hit</th><th>Miss</th><th>%</th></tr></thead><tbody>`;
            
            const sortedKeys = Object.keys(stats).sort((a,b) => {
                if (stats[b].headShots !== stats[a].headShots) return stats[b].headShots - stats[a].headShots;
                if (stats[b].totalScore !== stats[a].totalScore) return stats[b].totalScore - stats[a].totalScore;
                return isNaN(a) || isNaN(b) ? a.localeCompare(b) : parseInt(a) - parseInt(b);
            });

            sortedKeys.forEach(key => {
                const s = stats[key];
                if (s.shots > 0) {
                    const hs = s.headShots || 0;
                    const regularHits = (s.hits || 0) - hs;
                    const misses = s.shots - (s.hits || 0);
                    const pct = Math.round((hs / s.shots) * 100);
                    html += `<tr><td>${key}</td><td>${hs}</td><td>${regularHits}</td><td>${misses}</td><td>%${pct}</td></tr>`;
                }
            });
        } else {
            html = `<table class="stats-table"><thead><tr><th>Ok</th><th>İsabet</th><th>Toplam</th><th>%</th></tr></thead><tbody>`;
            
            const sortedKeys = Object.keys(stats).sort((a,b) => {
                if (stats[b].hits !== stats[a].hits) return stats[b].hits - stats[a].hits;
                return isNaN(a) || isNaN(b) ? a.localeCompare(b) : parseInt(a) - parseInt(b);
            });

            sortedKeys.forEach(key => {
                const s = stats[key];
                if (s.shots > 0) {
                    const pct = Math.round((s.hits / s.shots) * 100);
                    html += `<tr><td>${key}</td><td>${s.hits}</td><td>${s.shots}</td><td>%${pct}</td></tr>`;
                }
            });
        }
        html += `</tbody></table>`;
        content.innerHTML = html;
    }
    
    document.getElementById('statsModal').style.display = 'flex';
}

// --- OK ANALİZİ MODÜLÜ FONKSİYONLARI ---
let currentAnalysisType = '18m';

function renderArrowAnalysis(type, btnElement, sortMode = 'accuracy') {
    currentAnalysisType = type;
    if (btnElement) {
        document.querySelectorAll('#module-analysis .archive-btn').forEach(b => b.classList.remove('active'));
        btnElement.classList.add('active');
    }

    // Global verileri al
    const globalStatsKey = 'kemankesGlobalStats_' + type;
    const globalStats = JSON.parse(localStorage.getItem(globalStatsKey)) || {};
    
    // Aktif oturum verilerini al (Henüz kaydedilmemiş olanlar)
    const currentSessionStats = sessions[type].arrowStats;

    // Birleştir
    const stats = { ...globalStats };
    Object.keys(currentSessionStats).forEach(label => {
        if (!stats[label]) stats[label] = { hits: 0, shots: 0, totalScore: 0, headShots: 0, sessions: 0 };
        
        stats[label].hits = (stats[label].hits || 0) + currentSessionStats[label].hits;
        stats[label].shots = (stats[label].shots || 0) + currentSessionStats[label].shots;
        stats[label].totalScore = (stats[label].totalScore || 0) + (currentSessionStats[label].totalScore || 0);
        stats[label].headShots = (stats[label].headShots || 0) + (currentSessionStats[label].headShots || 0);
        if (currentSessionStats[label].shots > 0) {
            stats[label].sessions = (stats[label].sessions || 0) + 1;
        }
    });

    const container = document.getElementById('analysisContent');
    container.innerHTML = '';

    if (Object.keys(stats).length === 0) {
        container.innerHTML = '<div style="text-align:center; color:#666; margin-top:20px;">Bu modülde henüz atış verisi yok.</div>';
        return;
    }

    // Verileri işle
    let statsArray = [];

    Object.keys(stats).forEach(key => {
        const s = stats[key];
        if (s.shots > 0) {
            let pct;
            if (type === '18m') {
                pct = ((s.headShots || 0) / s.shots) * 100;
            } else {
                pct = (s.hits / s.shots) * 100;
            }
            statsArray.push({ 
                label: key, 
                hits: s.hits, 
                shots: s.shots, 
                pct: pct,
                totalScore: s.totalScore || 0,
                headShots: s.headShots || 0,
                sessions: s.sessions || 0
            });
        }
    });

    // Sıralama ve Gruplama
    if (sortMode === 'accuracy') {
        if (type === '18m') {
            // 18m: Önce Yüzde (İstikrar), Eşitse HS Sayısı (Tecrübe)
            statsArray.sort((a,b) => {
                if (b.pct !== a.pct) return b.pct - a.pct; // Yüzdesi yüksek olan üstte
                if (b.headShots !== a.headShots) return b.headShots - a.headShots; // Yüzde aynıysa çok vuran üstte
                return b.totalScore - a.totalScore;
            });
        } else {
            // 70m: Önce Yüzde, Eşitse İsabet Sayısı
            statsArray.sort((a,b) => {
                if (b.pct !== a.pct) return b.pct - a.pct;
                return b.hits - a.hits;
            });
        }
    } else {
        // Ok numarasına göre sırala
        statsArray.sort((a,b) => {
            const numA = parseInt(a.label.replace(/^\D+/g, ''));
            const numB = parseInt(b.label.replace(/^\D+/g, ''));
            return numA - numB;
        });
    }

    let topLimit = 12;
    let nextLimit = 8;

    const topList = statsArray.slice(0, topLimit);
    const nextList = statsArray.slice(topLimit, topLimit + nextLimit);
    // En isabetsizler için ters sıralama (Yüzdeye göre)
    const worst5 = [...statsArray].sort((a,b) => a.pct - b.pct || a.totalScore - b.totalScore).slice(0, 5);

    const createListCard = (title, items, color) => {
        if (items.length === 0) return '';
        let html = `<div class="analysis-card" style="border-color: ${color}; text-align:left;">
            <div style="color:${color}; font-size:14px; font-weight:bold; text-align:center; margin-bottom:10px;">${title}</div>`;
        
        items.forEach((item, i) => {
            const detail = type === '18m' ? `Kafa:${item.headShots} Puan:${item.totalScore}` : `${item.hits}/${item.shots}`;
            html += `<div style="display:flex; justify-content:space-between; border-bottom:1px solid #333; padding:5px 0; font-size:14px;">
                <span>#${i+1} <strong>${item.label}</strong> <span style="font-size:11px; color:#888;">(${item.sessions} Maç)</span></span>
                <span>${detail} (%${Math.round(item.pct)})</span>
            </div>`;
        });
        return html + `</div>`;
    };

    container.innerHTML += createListCard(`EN BAŞARILI ${topLimit} OK`, topList, "#4caf50");
    container.innerHTML += createListCard(`YEDEKLER (SONRAKİ ${nextLimit})`, nextList, "#d4af37");
    container.innerHTML += createListCard("EN İSABETSİZ 5 OK", worst5, "#f44336");

    // Tabloyu Oluştur
    let tableHtml = '';
    if (type === '18m') {
        tableHtml = `<table class="stats-table"><thead><tr><th>Ok</th><th>Kafa</th><th>Hit</th><th>Miss</th><th>%</th></tr></thead><tbody>`;
        statsArray.forEach(item => {
            const hs = item.headShots;
            const regularHits = item.hits - hs;
            const misses = item.shots - item.hits;
            tableHtml += `<tr><td>${item.label}</td><td>${hs}</td><td>${regularHits}</td><td>${misses}</td><td>%${Math.round(item.pct)}</td></tr>`;
        });
    } else {
        tableHtml = `<table class="stats-table"><thead><tr><th>Ok</th><th>İsabet</th><th>Atış</th><th>%</th></tr></thead><tbody>`;
        statsArray.forEach(item => {
            tableHtml += `<tr><td>${item.label}</td><td>${item.hits}</td><td>${item.shots}</td><td>%${Math.round(item.pct)}</td></tr>`;
        });
    }
    tableHtml += `</tbody></table>`;
    container.innerHTML += tableHtml;
}

function clearArrowAnalysis() {
    if(confirm("DİKKAT: " + (currentAnalysisType === '18m' ? '18m Salon' : '70m Açık Hava') + " için birikmiş tüm ok analiz verileri silinecek. Emin misiniz?")) {
        localStorage.removeItem('kemankesGlobalStats_' + currentAnalysisType);
        renderArrowAnalysis(currentAnalysisType);
    }
}

// --- ARŞİV VE GRAFİK FONKSİYONLARI ---

function renderArchive(type, btnElement) {
    // Buton aktiflik durumu
    if (btnElement) {
        document.querySelectorAll('.archive-btn').forEach(b => b.classList.remove('active'));
        btnElement.classList.add('active');
    }

    const storageKey = 'kemankesHistory_' + type;
    const historyData = JSON.parse(localStorage.getItem(storageKey)) || [];
    
    // Listeyi Doldur
    const listContainer = document.getElementById('archiveList');
    listContainer.innerHTML = '';
    
    if (historyData.length === 0) {
        listContainer.innerHTML = '<div style="color:#666; text-align:center; padding:20px;">Henüz kayıt bulunmuyor.</div>';
        document.getElementById('chartContainer').innerHTML = '';
        return;
    }

    historyData.forEach((item, index) => {
        const row = document.createElement('div');
        row.className = 'history-item';
        // Eski kayıtlarda date olmayabilir, kontrol et
        const dateDisplay = item.date ? item.date : "Tarihsiz";
        const avg = item.arrows > 0 ? (item.score / item.arrows).toFixed(2) : "0.00";

        row.innerHTML = `
            <div>
                <div style="color:#d4af37">${dateDisplay} ${item.time}</div>
                <div style="font-size:12px; color:#888;">Ort: ${avg} (${item.arrows} ok)</div>
            </div>
            <div style="display:flex; align-items:center;">
                <span style="font-weight:bold;">${item.score} Puan</span>
                <button class="btn-delete-record" onclick="deleteHistoryItem('${type}', ${index})">Sil</button>
            </div>
        `;
        listContainer.appendChild(row);
    });

    // Grafiği Çiz (Veriyi ters çevir ki eskiden yeniye gitsin)
    drawChart([...historyData].reverse());
}

function deleteHistoryItem(type, index) {
    if(!confirm("Bu kaydı silmek istediğinize emin misiniz?")) return;

    const storageKey = 'kemankesHistory_' + type;
    let historyData = JSON.parse(localStorage.getItem(storageKey)) || [];

    // İlgili indeksteki kaydı sil
    historyData.splice(index, 1);

    // Güncel listeyi kaydet
    localStorage.setItem(storageKey, JSON.stringify(historyData));

    // Ekranı yenile (buton elemanı olmadan çağırıyoruz)
    renderArchive(type);
}

function drawChart(data) {
    const container = document.getElementById('chartContainer');
    container.innerHTML = ''; // Temizle
    
    const width = container.clientWidth - 20; // Padding payı
    const height = container.clientHeight - 20;
    
    // Tooltip Elementi Oluştur
    const tooltip = document.createElement('div');
    tooltip.className = 'chart-tooltip';
    container.appendChild(tooltip);

    // Maksimum puanı bul (Grafik tavanı için)
    const maxScore = Math.max(...data.map(d => d.score), 10); // En az 10 olsun
    
    // SVG Oluştur
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    
    // Grid Çizgileri (3 adet)
    for(let i=1; i<=3; i++) {
        const y = height - (height * (i/3));
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", 0);
        line.setAttribute("y1", y);
        line.setAttribute("x2", width);
        line.setAttribute("y2", y);
        line.setAttribute("class", "chart-grid");
        svg.appendChild(line);
    }

    // Çizgi Yolu Oluştur
    let pathD = "";
    const stepX = width / (data.length > 1 ? data.length - 1 : 1);
    
    // Noktalar grubu (çizginin üstünde görünsün diye ayrı grup)
    const dotsGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");

    data.forEach((item, index) => {
        const x = index * stepX;
        // Puanı Y eksenine oranla (Yükseklik - (Puan/Max * Yükseklik))
        const y = height - ((item.score / maxScore) * height); // Basit oranlama
        
        if (index === 0) pathD += `M ${x} ${y}`;
        else pathD += ` L ${x} ${y}`;

        // Nokta Oluştur
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", x);
        circle.setAttribute("cy", y);
        circle.setAttribute("class", "chart-dot");
        
        // Tıklama Olayı (Tooltip Göster)
        circle.addEventListener('click', (e) => {
            e.stopPropagation(); // Arka plana tıklamayı engelle
            
            // Tooltip İçeriği
            tooltip.innerHTML = `
                <div style="font-weight:bold; color:#d4af37; margin-bottom:5px; border-bottom:1px solid #444; padding-bottom:3px;">
                    ${item.date || 'Tarih Yok'} - ${item.time}
                </div>
                <div>🎯 Puan: <strong>${item.score}</strong></div>
                <div>🏹 Ok Sayısı: ${item.arrows}</div>
                ${item.note ? `<div style="margin-top:5px; font-style:italic; color:#aaa; border-top:1px solid #333; padding-top:3px;">📝 ${item.note}</div>` : ''}
            `;
            
            // Pozisyon Ayarla
            tooltip.style.display = 'block';
            // Eğer sağ kenara çok yakınsa tooltip'i sola doğru aç
            if (x > width / 2) {
                tooltip.style.left = 'auto';
                tooltip.style.right = (width - x + 10) + 'px';
            } else {
                tooltip.style.left = (x + 10) + 'px';
                tooltip.style.right = 'auto';
            }
            tooltip.style.top = (y - 10) + 'px';
        });

        dotsGroup.appendChild(circle);
    });

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", pathD);
    path.setAttribute("class", "chart-line");
    
    svg.appendChild(path);
    svg.appendChild(dotsGroup);
    container.appendChild(svg);

    // Boşluğa tıklayınca tooltip'i kapat
    container.addEventListener('click', () => {
        tooltip.style.display = 'none';
    });
}

// --- NOTLAR MODÜLÜ FONKSİYONLARI ---
let editingNoteIndex = null;

function toggleNoteForm(show) {
    document.getElementById('addNoteForm').style.display = show ? 'block' : 'none';
    document.getElementById('showFormBtn').style.display = show ? 'none' : 'block';
    if (!show) {
        document.getElementById('noteTitle').value = '';
        document.getElementById('noteEditor').innerHTML = '';
        editingNoteIndex = null;
    }
}

function handleNoteImage(input) {
    if (input.files && input.files[0]) {
        // Resmi küçült ve Base64'e çevir
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // Maksimum boyut (örn: 800px)
                const MAX_WIDTH = 800;
                const MAX_HEIGHT = 800;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);
                
                const base64 = canvas.toDataURL('image/jpeg', 0.7); // %70 kalite
                
                // Editöre resim ekle
                const editor = document.getElementById('noteEditor');
                editor.focus();
                
                // İmleç pozisyonuna veya sona ekle
                const imgElem = `<img src="${base64}"><br>`;
                document.execCommand('insertHTML', false, imgElem);
                
                // Inputu sıfırla
                input.value = '';
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(input.files[0]);
    }
}

function saveNote() {
    const title = document.getElementById('noteTitle').value;
    const content = document.getElementById('noteEditor').innerHTML;
    
    if (!title.trim() && !content.trim()) {
        alert("Lütfen bir başlık veya içerik girin.");
        return;
    }

    const notes = JSON.parse(localStorage.getItem('kemankesNotes')) || [];
    
    if (editingNoteIndex !== null) {
        // Mevcut notu güncelle
        notes[editingNoteIndex].title = title;
        notes[editingNoteIndex].text = content;
        // Eski yapıdaki image alanını temizle (artık text içinde HTML olarak var)
        delete notes[editingNoteIndex].image;
    } else {
        // Yeni not ekle
        const newNote = {
            id: Date.now(),
            date: new Date().toLocaleDateString('tr-TR'),
            title: title,
            text: content
        };
        notes.unshift(newNote);
    }
    
    localStorage.setItem('kemankesNotes', JSON.stringify(notes));
    
    toggleNoteForm(false);
    renderNotes();
}

function renderNotes() {
    const list = document.getElementById('notesList');
    const notes = JSON.parse(localStorage.getItem('kemankesNotes')) || [];
    list.innerHTML = '';

    if (notes.length === 0) {
        list.innerHTML = '<div style="text-align:center; color:#666;">Henüz not eklenmemiş.</div>';
        return;
    }

    notes.forEach((note, index) => {
        const card = document.createElement('div');
        card.className = 'note-card';
        card.onclick = () => openNoteDetail(index); // Tıklayınca detay aç
        
        // Önizleme Metni Oluştur (HTML etiketlerini temizle)
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = note.text || '';
        let plainText = tempDiv.textContent || tempDiv.innerText || '';
        
        // Eğer metin yoksa ama resim varsa
        if (!plainText.trim() && (note.text.includes('<img') || note.image)) {
            plainText = "📷 [Resim]";
        } else if (!plainText.trim()) {
            plainText = "İçerik yok...";
        }

        const displayTitle = note.title 
            ? `<div style="font-weight:bold; color:#d4af37; font-size:16px; margin-bottom:5px;">${note.title}</div>` 
            : `<div style="font-weight:bold; color:#666; font-size:16px; margin-bottom:5px;">Başlıksız</div>`;

        let html = `
            <div class="note-header">
                <span>${note.date}</span>
                <div>
                    <button onclick="event.stopPropagation(); editNote(${index})" style="background:none; border:none; color:#d4af37; font-size:16px; padding:0; cursor:pointer; margin-right:10px;">✏️</button>
                    <button onclick="event.stopPropagation(); deleteNote(${index})" style="background:none; border:none; color:#8b0000; font-size:16px; padding:0; cursor:pointer;">🗑️</button>
                </div>
            </div>
            ${displayTitle}
            <div class="note-preview-text">${plainText}</div>
        `;

        card.innerHTML = html;
        list.appendChild(card);
    });
}

function openNoteDetail(index) {
    const notes = JSON.parse(localStorage.getItem('kemankesNotes')) || [];
    const note = notes[index];
    if (!note) return;

    document.getElementById('noteDetailDate').innerText = note.date;
    document.getElementById('noteDetailTitle').innerText = note.title || 'Başlıksız Not';
    
    // İçerik Hazırlama (Legacy desteği ile)
    let content = note.text || '';
    // Eski düz metin formatı kontrolü
    if (content && !content.includes('<') && content.includes('\n')) {
            content = content.replace(/\n/g, '<br>');
    }
    // Eski resim formatı kontrolü
    if (note.image) {
            content += `<br><img src="${note.image}" style="max-width:100%; border-radius:8px; margin-top:10px;">`;
    }
    
    const body = document.getElementById('noteDetailBody');
    body.innerHTML = content;
    
    // Resimlere tıklama özelliği (Modal içinde modal açmak için)
    const images = body.querySelectorAll('img');
    images.forEach(img => {
        img.onclick = () => openImageModal(img.src);
        img.style.cursor = 'pointer';
    });

    // Düzenle butonu
    const editBtn = document.getElementById('noteDetailEditBtn');
    editBtn.onclick = () => {
        document.getElementById('noteDetailModal').style.display = 'none';
        editNote(index);
    };

    document.getElementById('noteDetailModal').style.display = 'flex';
}

function editNote(index) {
    const notes = JSON.parse(localStorage.getItem('kemankesNotes')) || [];
    const note = notes[index];
    if (!note) return;

    editingNoteIndex = index;
    document.getElementById('noteTitle').value = note.title || '';
    
    // Düzenleme için içeriği hazırla
    let content = note.text;
    if (note.image) {
            content += `<br><img src="${note.image}">`;
    }
    if (note.text && !note.text.includes('<') && note.text.includes('\n')) {
            content = note.text.replace(/\n/g, '<br>');
            if (note.image) content += `<br><img src="${note.image}">`;
    }
    
    document.getElementById('noteEditor').innerHTML = content;
    
    toggleNoteForm(true);
}

function deleteNote(index) {
    if(!confirm("Bu notu silmek istediğinize emin misiniz?")) return;
    const notes = JSON.parse(localStorage.getItem('kemankesNotes')) || [];
    notes.splice(index, 1);
    localStorage.setItem('kemankesNotes', JSON.stringify(notes));
    renderNotes();
}

function openImageModal(src) {
    document.getElementById('fullImage').src = src;
    document.getElementById('imageModal').style.display = 'flex';
}

// --- AYARLAR VE YEDEKLEME ---
function exportData() {
    const data = {};
    // LocalStorage'daki tüm kemankes verilerini topla
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('kemankes')) {
            data[key] = JSON.parse(localStorage.getItem(key));
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

function importData(input) {
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

function hardResetApp() {
    if(confirm("DİKKAT: Tüm verileriniz silinecek ve uygulama sıfırlanacak. Bu işlem geri alınamaz! Emin misiniz?")) {
        localStorage.clear();
        location.reload();
    }
}

function toggleTheme() {
    document.body.classList.toggle('light-mode');
    const isLight = document.body.classList.contains('light-mode');
    localStorage.setItem('kemankesTheme', isLight ? 'light' : 'dark');
}

// --- HEDEF ANALİZİ FONKSİYONLARI ---

function switchTargetRound(roundNum) {
    currentTargetRound = roundNum;
    
    // Güvenlik: Veri dizisi yoksa oluştur
    if (!targetSessionData || !Array.isArray(targetSessionData)) {
        targetSessionData = Array(7).fill(null).map(() => []);
    }
    
    // Güvenlik kontrolü: targetSessionData bozuksa onar
    if (!targetSessionData || !Array.isArray(targetSessionData) || targetSessionData.length < 7) {
        targetSessionData = Array(7).fill(null).map(() => []);
    }
    
    targetPoints = targetSessionData[roundNum - 1]; // Referansı güncelle
    
    // UI Güncelle
    const buttons = document.querySelectorAll('.t-round-btn');
    buttons.forEach((btn, index) => {
        if (index + 1 === roundNum) btn.classList.add('active');
        else btn.classList.remove('active');
        
        // Veri varsa işaretle
        if (targetSessionData[index] && targetSessionData[index].length > 0) {
            btn.classList.add('has-data');
        } else {
            btn.classList.remove('has-data');
        }
    });
    renderTargetMarks();
}

function handleTargetClick(event) {
    try {
        // Eğer tıklanan yer bir işaretçi ise (grup veya içindekiler), yeni nokta ekleme
        // (Bu kontrol stopPropagation çalışmazsa diye ek güvenliktir)
        if (event.target.closest && event.target.closest('g') && event.target.closest('g').hasAttribute('onclick')) return;

        // 1. Veri Yapısını Garantiye Al
        if (!targetSessionData || !Array.isArray(targetSessionData)) {
            targetSessionData = Array(7).fill(null).map(() => []);
        }
        
        // Mevcut turun dizisine doğrudan eriş (targetPoints referansına güvenme)
        let currentRoundData = targetSessionData[currentTargetRound - 1];
        if (!currentRoundData) {
            targetSessionData[currentTargetRound - 1] = [];
            currentRoundData = targetSessionData[currentTargetRound - 1];
        }

        const svg = document.getElementById('targetFace');
        const pt = svg.createSVGPoint();
        const inputSet = document.getElementById('arrowSetInput').value;
        
        // Tıklama koordinatlarını SVG koordinatlarına çevir
        pt.x = event.clientX;
        pt.y = event.clientY;
        
        // Matrix dönüşümü (Hata korumalı)
        const ctm = svg.getScreenCTM();
        if (!ctm) return; // SVG görünür değilse çık
        const svgP = pt.matrixTransform(ctm.inverse());

        // Etiket Belirleme (Set varsa oradan çek, yoksa sıradaki sayı)
        let label = (currentRoundData.length + 1).toString();
        
        if (inputSet.trim() !== "") {
            // Virgülle ayrılmış numaraları diziye çevir
            const setNumbers = inputSet.split(',').map(s => s.trim());
            // Sıradaki ok setin içinde varsa onu kullan
            if (currentRoundData.length < setNumbers.length) {
                label = setNumbers[currentRoundData.length];
            }
        }

        // Noktayı kaydet
        currentRoundData.push({x: svgP.x, y: svgP.y, label: label});
        
        // Global referansı güncelle
        targetPoints = currentRoundData;
        
    } catch (err) {
        console.error("Hedef tıklama hatası:", err);
    }
    
    // Tur butonundaki "has-data" durumunu güncellemek için
    switchTargetRound(currentTargetRound);
}

function switchTargetFace(faceType, btnElement) {
    currentTargetFace = faceType;
    if (btnElement) {
        document.querySelectorAll('#module-target .archive-btn').forEach(b => b.classList.remove('active'));
        btnElement.classList.add('active');
    }
    
    const config = targetConfigs[faceType];
    if (config) {
        const img = document.getElementById('targetImg');
        if (img) img.setAttribute('href', config.image);
    }
    renderTargetMarks();
}

function renderTargetMarks() {
        const svgGroup = document.getElementById('targetMarks');
        if (!svgGroup) return;
        svgGroup.innerHTML = '';
        
        // Veriyi doğrudan ana kaynaktan oku
        const pointsToRender = targetSessionData[currentTargetRound - 1];
        
        if (pointsToRender && Array.isArray(pointsToRender)) {
            pointsToRender.forEach((pt, index) => {
                // Grup oluştur (Tıklama ve düzenleme için)
                const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
                g.setAttribute("transform", `translate(${pt.x}, ${pt.y})`);
                g.setAttribute("onclick", `editTargetMark(${index}, event)`);
                g.style.cursor = "pointer"; // Üzerine gelince el işareti çıksın

                // 1. Tüyler (Fletchings) - 3 adet (Ok arkası görünümü)
                const colors = ["#f44336", "#2196f3", "#4caf50", "#ffeb3b", "#9c27b0", "#ff9800"];
                const color = colors[index % colors.length];
                
                for(let i=0; i<3; i++) {
                    const rot = i * 120;
                    const vane = document.createElementNS("http://www.w3.org/2000/svg", "rect");
                    vane.setAttribute("x", -1.5);
                    vane.setAttribute("y", -12);
                    vane.setAttribute("width", 3);
                    vane.setAttribute("height", 12);
                    vane.setAttribute("fill", color);
                    vane.setAttribute("stroke", "#000");
                    vane.setAttribute("stroke-width", "0.5");
                    vane.setAttribute("transform", `rotate(${rot})`);
                    g.appendChild(vane);
                }

                // 2. Gez/Nock (Merkez Daire)
                const nock = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                nock.setAttribute("r", 3.5);
                nock.setAttribute("fill", "#fff");
                nock.setAttribute("stroke", "#000");
                g.appendChild(nock);
                
                const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
                text.setAttribute("x", 8);
                text.setAttribute("y", 4);
                text.setAttribute("text-anchor", "start");
                text.setAttribute("fill", "#fff");
                text.setAttribute("font-size", "11px");
                text.setAttribute("font-weight", "bold");
                text.style.textShadow = "1px 1px 2px #000"; // Okunabilirlik için gölge
                text.textContent = pt.label;
                
                g.appendChild(text);
                svgGroup.appendChild(g);
            });
        }
}

function editTargetMark(index, event) {
    event.stopPropagation(); // Tıklamanın arkadaki hedefe geçip yeni nokta oluşturmasını engelle
    
    const currentData = targetSessionData[currentTargetRound - 1];
    const pt = currentData[index];
    
    const newVal = prompt("Ok numarasını düzenle (Silmek için boş bırakıp tamam deyin):", pt.label);
    
    if (newVal !== null) {
        if (newVal.trim() === "") {
            currentData.splice(index, 1); // Sil
        } else {
            pt.label = newVal; // Güncelle
        }
        renderTargetMarks();
        // Veri değiştiği için UI güncellemesi gerekebilir (örneğin buton durumu)
        switchTargetRound(currentTargetRound);
    }
}

function undoTargetMark() {
    if (targetPoints && targetPoints.length > 0) {
        targetPoints.pop();
        renderTargetMarks();
        switchTargetRound(currentTargetRound);
    }
}

function injectTargetResetButton() {
    let undoBtn = document.querySelector('button[onclick="window.undoTargetMark()"]');
    if (!undoBtn) undoBtn = document.querySelector('button[onclick="undoTargetMark()"]');
    
    if (undoBtn && !document.getElementById('btnResetTarget')) {
        const btn = document.createElement('button');
        btn.id = 'btnResetTarget';
        btn.innerText = 'Hepsini Sil';
        btn.className = undoBtn.className;
        btn.style.cssText = undoBtn.style.cssText;
        btn.style.marginLeft = '10px';
        btn.style.backgroundColor = '#8b0000';
        btn.onclick = resetTargetSession;
        undoBtn.parentNode.insertBefore(btn, undoBtn.nextSibling);
    }
}

function resetTargetSession() {
    if(confirm("Tüm turları sıfırlamak istediğinize emin misiniz?")) {
        targetSessionData = Array(7).fill(null).map(() => []);
        targetPoints = targetSessionData[0];
        switchTargetRound(1);
        alert("Tüm turlar sıfırlandı ve veri girişine hazır.");
    }
}

function saveTargetAnalysis() {
        const historyItem = {
            date: new Date().toLocaleDateString('tr-TR'),
            time: new Date().toLocaleTimeString('tr-TR'),
            face: currentTargetFace,
            rounds: targetSessionData
        };
        
        const savedHistory = JSON.parse(localStorage.getItem('kemankesTargetHistory')) || [];
        savedHistory.unshift(historyItem);
        localStorage.setItem('kemankesTargetHistory', JSON.stringify(savedHistory));
        
        targetSessionData = Array(7).fill(null).map(() => []);
        switchTargetRound(1);
        alert("Hedef analizi kaydedildi.");
        loadTargetHistoryUI();
}

function loadTargetAnalysisFromHistory(index) {
    const history = JSON.parse(localStorage.getItem('kemankesTargetHistory')) || [];
    const item = history[index];
    if (!item) return;

    // Mevcut veride değişiklik varsa uyar
    const hasData = targetSessionData.some(r => r && r.length > 0);
    if (hasData) {
        if (!confirm("Ekrandaki mevcut analiz verileri temizlenecek ve seçilen geçmiş yüklenecek. Devam edilsin mi?")) return;
    }

    // Veriyi yükle
    targetSessionData = JSON.parse(JSON.stringify(item.rounds));
    currentTargetFace = item.face;

    // Hedef Tipi Butonunu Güncelle
    document.querySelectorAll('#module-target .archive-btn').forEach(btn => {
        if (btn.getAttribute('onclick').includes(`'${currentTargetFace}'`)) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Görüntüyü ve Noktaları Güncelle
    switchTargetFace(currentTargetFace, null);
    switchTargetRound(1);
    
    // Yukarı kaydır
    document.querySelector('.target-wrapper').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function loadTargetHistoryUI() {
    const list = document.getElementById('targetHistoryList');
    if (!list) return;
    const history = JSON.parse(localStorage.getItem('kemankesTargetHistory')) || [];
    list.innerHTML = '';
    
    history.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'history-item';
        div.innerHTML = `
            <div onclick="loadTargetAnalysisFromHistory(${index})" style="cursor:pointer; flex-grow:1;">
                <div style="color:#d4af37">${item.date} ${item.time}</div>
                <div style="font-size:12px; color:#888;">${item.face} - ${item.rounds.reduce((acc, r) => acc + r.length, 0)} ok</div>
            </div>
            <button class="btn-delete-record" onclick="deleteTargetHistory(${index})">Sil</button>
        `;
        list.appendChild(div);
    });
}

function deleteTargetHistory(index) {
    if(!confirm("Silmek istediğinize emin misiniz?")) return;
    const history = JSON.parse(localStorage.getItem('kemankesTargetHistory')) || [];
    history.splice(index, 1);
    localStorage.setItem('kemankesTargetHistory', JSON.stringify(history));
    loadTargetHistoryUI();
}

// --- YAY AYARLARI FONKSİYONLARI ---
let currentBowSlot = 0;

function openBowSettings() {
    // Modalı aç
    document.getElementById('bowSettingsModal').style.display = 'flex';
    // İlk slotu yükle
    switchBowSlot(0);
}

function switchBowSlot(slotIndex) {
    currentBowSlot = slotIndex;
    
    // Buton stillerini güncelle
    for(let i=0; i<3; i++) {
        const btn = document.getElementById(`bowSlot${i}`);
        if (i === slotIndex) {
            btn.classList.add('selected');
            btn.style.backgroundColor = '#d4af37';
            btn.style.color = '#000';
        } else {
            btn.classList.remove('selected');
            btn.style.backgroundColor = '#333';
            btn.style.color = '#fff';
        }
    }

    // Veriyi Çek
    const allSettings = JSON.parse(localStorage.getItem('kemankesBowSettings')) || {};
    // Yapı: { '18m': [slot0, slot1, slot2], '70m': [...] }
    
    const moduleSettings = allSettings[activeModuleId] || [{}, {}, {}];
    const slotData = moduleSettings[slotIndex] || {};

    // Formu Doldur
    document.getElementById('bowName').value = slotData.name || '';
    document.getElementById('bowBrace').value = slotData.brace || '';
    document.getElementById('bowNock').value = slotData.nock || '';
    document.getElementById('bowFinger').value = slotData.finger || '';
}

function saveBowSettings() {
    const allSettings = JSON.parse(localStorage.getItem('kemankesBowSettings')) || {};
    if (!allSettings[activeModuleId]) {
        allSettings[activeModuleId] = [{}, {}, {}];
    }

    const newData = {
        name: document.getElementById('bowName').value,
        brace: document.getElementById('bowBrace').value,
        nock: document.getElementById('bowNock').value,
        finger: document.getElementById('bowFinger').value
    };

    allSettings[activeModuleId][currentBowSlot] = newData;
    localStorage.setItem('kemankesBowSettings', JSON.stringify(allSettings));
    
    // Geri bildirim
    const btn = document.querySelector('#bowFormContent .btn-add-note');
    const originalText = btn.innerText;
    btn.innerText = "✅ Kaydedildi";
    btn.style.backgroundColor = "#4caf50";
    setTimeout(() => {
        btn.innerText = originalText;
        btn.style.backgroundColor = "#d4af37";
    }, 1500);
}

// --- HAVA DURUMU FONKSİYONLARI ---
function toggleWeatherModal() {
    const modal = document.getElementById('weatherModal');
    const manualInput = document.getElementById('manualLocationInput');
    
    if (modal.style.display === 'flex') {
        modal.style.display = 'none';
    } else {
        modal.style.display = 'flex';
        manualInput.style.display = 'none'; // Önce gizle
        getWeatherData();
    }
}

function getWeatherData() {
    const statusDiv = document.getElementById('weatherStatus');
    const manualInput = document.getElementById('manualLocationInput');
    statusDiv.innerHTML = "Konum alınıyor...";
    
    if (!navigator.geolocation) {
        statusDiv.innerHTML = "Tarayıcınız konum servisini desteklemiyor.";
        manualInput.style.display = 'block';
        return;
    }

    navigator.geolocation.getCurrentPosition(async (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        
        statusDiv.innerHTML = "Veriler indiriliyor...";
        
        try {
            // 1. Hava Durumu (Open-Meteo API - Ücretsiz)
            const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=surface_pressure,wind_speed_10m,wind_direction_10m,temperature_2m`);
            const weatherData = await weatherRes.json();
            
            // 2. Konum Adı (Nominatim API - Ücretsiz)
            const locRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
            const locData = await locRes.json();
            
            renderWeatherUI(weatherData, locData);
            statusDiv.innerHTML = "";
        } catch (err) {
            console.error(err);
            statusDiv.innerHTML = "Veri alınamadı. İnternet bağlantınızı kontrol edin.";
            manualInput.style.display = 'block';
        }
    }, (err) => {
        console.error(err);
        statusDiv.innerHTML = "Konum izni verilmedi. Lütfen şehir girin:";
        manualInput.style.display = 'block';
    });
}

async function getWeatherByCity() {
    const city = document.getElementById('cityInput').value;
    if(!city) return;
    
    const statusDiv = document.getElementById('weatherStatus');
    statusDiv.innerHTML = "Konum aranıyor...";
    
    try {
        // Geocoding (Nominatim - Daha detaylı arama için OSM kullanıyoruz)
        const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&limit=1`);
        const geoData = await geoRes.json();
        
        if(!geoData || geoData.length === 0) {
            statusDiv.innerHTML = "Konum bulunamadı. İlçe ve İl birlikte yazmayı deneyin.";
            return;
        }
        
        const result = geoData[0];
        const lat = result.lat;
        const lon = result.lon;
        // Nominatim display_name çok uzundur, sadece ilk kısmını alalım
        const name = result.display_name.split(',')[0];
        
        // Weather
        const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=surface_pressure,wind_speed_10m,wind_direction_10m,temperature_2m`);
        const weatherData = await weatherRes.json();
        
        renderWeatherUI(weatherData, null, name);
        
        statusDiv.innerHTML = "";
        document.getElementById('manualLocationInput').style.display = 'none';
        
    } catch (err) {
        console.error(err);
        statusDiv.innerHTML = "Bağlantı hatası.";
    }
}

function renderWeatherUI(weather, location, manualName) {
    if (!weather || !weather.current) {
        const statusDiv = document.getElementById('weatherStatus');
        statusDiv.innerHTML = "Geçerli hava durumu verisi alınamadı.";
        document.getElementById('manualLocationInput').style.display = 'block';
        return;
    }
    const current = weather.current;
    
    // Konum Formatlama
    let locString = "";
    
    if (manualName) {
        locString = manualName;
    } else if (location && location.address) {
        const address = location.address;
        if (address.suburb) locString += address.suburb;
        else if (address.neighbourhood) locString += address.neighbourhood;
        
        if (address.district) locString += (locString ? ", " : "") + address.district;
        if (address.province) locString += (locString ? ", " : "") + address.province;
    }
    
    if (!locString) locString = "Bilinmeyen Konum";

    document.getElementById('weatherLocation').innerText = "📍 " + locString;
    
    // Değerler
    const temp = current.temperature_2m;
    const pressure = current.surface_pressure;
    
    // Yoğunluk İrtifası Hesaplama (Density Altitude)
    // 1. Basınç İrtifası (Pressure Altitude - Hp) [Metre cinsinden yaklaşık formül]
    // Hp = 44330 * (1 - (P / 1013.25)^(1/5.255))
    const pressureAlt = 44330.8 * (1 - Math.pow(pressure / 1013.25, 0.190263));
    
    // 2. Standart Sıcaklık (ISA Temperature at Hp)
    const isaTemp = 15 - (0.0065 * pressureAlt);
    
    // 3. Yoğunluk İrtifası (Density Altitude - DA) [Metre]
    // DA = Hp + 36.6 * (T - T_isa)  (Yaklaşık formül: 120ft/C)
    const densityAlt = pressureAlt + (36.6 * (temp - isaTemp));

    document.getElementById('weatherTemp').innerText = temp + " °C";
    document.getElementById('weatherDA').innerText = Math.round(densityAlt) + " m";
    document.getElementById('weatherWindSpeed').innerText = current.wind_speed_10m + " km/s";
    document.getElementById('weatherPressure').innerText = pressure + " hPa";
    
    // Balistik Tavsiye (Isparta ~1000m referans alınarak)
    const tipElement = document.getElementById('weatherTip');
    if(tipElement) {
        let tipText = "";
        if (densityAlt < 800) {
            tipText = "❄️ Hava Yoğun (Çorba): Oklar 'Paraşüt Etkisi' ile yavaşlayıp aşağı düşebilir. Nişanı biraz yukarı al.";
        } else if (densityAlt > 1400) {
            tipText = "🔥 Hava İnce: Oklar daha az sürtünmeyle süzülür (Gliding). Nişanı biraz aşağı al.";
        } else {
            tipText = "✅ Hava Normal: Standart nişan ve teknikle atış yapabilirsin.";
        }
        tipElement.innerText = tipText;
    }
    
    // Rüzgar Yönü Oku
    const arrow = document.getElementById('windArrowIcon');
    arrow.style.transform = `rotate(${current.wind_direction_10m}deg)`;
    
    document.getElementById('weatherContent').style.display = 'block';
}

// SERVICE WORKER KAYDI (OFFLINE KULLANIM İÇİN)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Service Worker kayıt edildi.', reg.scope))
            .catch(err => console.log('Service Worker hatası:', err));
    });
}