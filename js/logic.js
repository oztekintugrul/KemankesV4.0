// js/logic.js - V3.2 (COACH MODULE & TARGET ZOOM)
import { state, moduleConfigs, targetConfigs } from './data.js';
import { saveActiveSession } from './storage.js?v=13.5';
import * as UI from './ui.js?v=13.5';

console.log("🛠️ Logic Modülü Yüklendi (V3.2)...");

// 1. OYUN YÖNETİMİ
const moduleStrategies = {
    'archive': () => {
        document.getElementById('module-archive')?.classList.add('active');
        UI.renderArchive('18m');
    },
    'target': () => {
        document.getElementById('module-target')?.classList.add('active');
        UI.loadTargetHistoryUI();
        switchTargetFace(state.currentTargetFace, null, false);
        switchTargetRound(state.currentTargetRound);
        UI.injectTargetResetButton();
    },
    'analysis': () => {
        document.getElementById('module-analysis')?.classList.add('active');
        if(UI.renderArrowAnalysis) UI.renderArrowAnalysis('18m');
    },
    'notes': () => {
        document.getElementById('module-notes')?.classList.add('active');
        if(UI.renderNotes) UI.renderNotes();
    },
    'settings': () => {
        document.getElementById('module-settings')?.classList.add('active');
    },
    'coach': () => {
        document.getElementById('module-coach')?.classList.add('active');
        UI.renderDrills(); // Varsayılan olarak Drill sekmesini aç
    }
};

function initGameModule(moduleId) {
    document.getElementById('game-interface')?.classList.add('active');
    
    if (state.sessions[moduleId]) {
        const session = state.sessions[moduleId];
        state.currentArrowLabels = session.arrowLabels;
        const prefix = moduleId === '18m' ? 'K' : 'B';
        UI.generateArrowSelectorButtons(prefix);
        UI.renderArrowSelector();
    }
    
    UI.updateKeypad(moduleId);
    UI.renderUI();
    UI.loadHistoryUI();
    
    const btnWeather = document.getElementById('btnWeather');
    if (btnWeather) btnWeather.style.display = (moduleId === '70m') ? 'block' : 'none';
}

export function switchModule(moduleId) {
    state.activeModuleId = moduleId;
    saveActiveSession();
    
    // UI Reset
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById('btn-' + moduleId);
    if(activeBtn) activeBtn.classList.add('active');
    UI.toggleRightSidebar(false);
    document.querySelectorAll('.module').forEach(el => el.classList.remove('active'));

    // Strategy Execution
    if (moduleStrategies[moduleId]) {
        moduleStrategies[moduleId]();
    } else {
        initGameModule(moduleId);
    }
}

function updateArrowStats(label, isHit, shotCount, points = 0) { const session = state.sessions[state.activeModuleId]; if (!session.arrowStats[label]) { session.arrowStats[label] = { hits: 0, shots: 0, totalScore: 0, headShots: 0 }; } session.arrowStats[label].shots += shotCount; if (isHit) session.arrowStats[label].hits += shotCount; session.arrowStats[label].totalScore = (session.arrowStats[label].totalScore || 0) + (points * shotCount); if (points === 3) session.arrowStats[label].headShots = (session.arrowStats[label].headShots || 0) + shotCount; }
export function addScore(points) { const session = state.sessions[state.activeModuleId]; const config = moduleConfigs[state.activeModuleId]; if (session.isFinished) { alert("Antrenman bitti!"); return; } if (config.inputType === 'round_18m' || config.inputType === 'round') { let roundScore = 0; let historyData = {}; if (config.inputType === 'round_18m') { roundScore = points.score; historyData = { score: roundScore, detailedShots: points.detailedShots }; points.detailedShots.forEach(shot => updateArrowStats(shot.label, shot.score > 0, 1, shot.score)); } else { const hitCount = typeof points === 'object' ? points.hitCount : points; roundScore = hitCount * 1; const hitLabels = (typeof points === 'object' && points.hitLabels) ? points.hitLabels : []; historyData = { score: roundScore, hitLabels: hitLabels }; if (hitLabels.length > 0) { for(let i=0; i<config.arrowsPerRound; i++) { const label = state.currentArrowLabels[i] || (i+1).toString(); const isHit = hitLabels.includes(label); updateArrowStats(label, isHit, 1, isHit ? 1 : 0); } } } session.score += roundScore; session.shotHistory.push(historyData); session.totalArrows += config.arrowsPerRound; session.roundScores[session.currentRound - 1] = roundScore; session.arrowsInRound = config.arrowsPerRound; } else { const val = points; session.score += val; session.totalArrows++; session.roundScores[session.currentRound - 1] += val; session.arrowsInRound++; session.shotHistory.push({points: val}); const lbl = state.currentArrowLabels[session.arrowsInRound-1] || session.arrowsInRound.toString(); updateArrowStats(lbl, val > 0, 1, val); } renderUI(); if (session.arrowsInRound >= config.arrowsPerRound) { if (session.currentRound < config.rounds) { session.currentRound++; session.arrowsInRound = 0; renderUI(); } else { session.isFinished = true; alert("Tebrikler! Bitti."); } } saveActiveSession(); }
export function toggleArrow18m(index) { const session = state.sessions['18m']; let val = session.uiState.arrowStates18m[index] || 0; if (val === 0) val = 1; else if (val === 1) val = 3; else val = 0; session.uiState.arrowStates18m[index] = val; saveActiveSession(); const btn = document.getElementById(`arrowBtn18m_${index}`); const style = UI.getButtonStyle18m(val); btn.style = style.style; const lbl = state.currentArrowLabels[index] || (index+1).toString(); btn.innerHTML = `${lbl}<br>${style.text}`; }
export function toggleArrow70m(index) { const session = state.sessions['70m']; let selected = session.uiState.selectedArrows70m; const idx = selected.indexOf(index); const btn = document.getElementById(`arrowBtn70m_${index}`); if (idx === -1) { selected.push(index); btn.style.backgroundColor = '#d4af37'; btn.style.color = '#000'; } else { selected.splice(idx, 1); btn.style.backgroundColor = '#333'; btn.style.color = '#fff'; } session.uiState.selectedArrows70m = selected; saveActiveSession(); }
export function undoLastShot() { const session = state.sessions[state.activeModuleId]; if(session.shotHistory.length === 0) return; const last = session.shotHistory.pop(); if(session.isFinished) session.isFinished = false; if (last.score !== undefined) { session.currentRound--; session.arrowsInRound = 0; session.totalArrows -= moduleConfigs[state.activeModuleId].arrowsPerRound; session.score -= last.score; session.roundScores[session.currentRound-1] = 0; if(last.detailedShots) last.detailedShots.forEach(s => updateArrowStats(s.label, s.score > 0, -1, s.score)); else if(last.hitLabels) last.hitLabels.forEach(l => updateArrowStats(l, true, -1, 1)); } else { session.totalArrows--; session.arrowsInRound--; session.score -= last.points; session.roundScores[session.currentRound-1] -= last.points; if(session.arrowsInRound < 0 && session.currentRound > 1) { session.currentRound--; session.arrowsInRound = moduleConfigs[state.activeModuleId].arrowsPerRound - 1; } } renderUI(); saveActiveSession(); }
function checkArrowSelection() { const session = state.sessions[state.activeModuleId]; if (!session.arrowLabels || session.arrowLabels.length === 0) { const btn = document.getElementById('btnArrowSelect'); if(btn) { btn.classList.remove('flash-warning'); void btn.offsetWidth; btn.classList.add('flash-warning'); } return confirm("⚠️ Henüz ok grubu seçmediniz!\n\nSeçim yapmadan devam etmek istiyor musunuz?\n\n(Devam ederseniz istatistik tutulmayacaktır.)"); } return true; }
export function submitRound18m() { if (!checkArrowSelection()) return; const session = state.sessions['18m']; const currentStates = session.uiState.arrowStates18m; let totalScore = 0; let detailedShots = []; currentStates.forEach((val, idx) => { totalScore += val; detailedShots.push({ label: (state.currentArrowLabels[idx] || idx+1), score: val }); }); addScore({ score: totalScore, detailedShots: detailedShots }); session.uiState.arrowStates18m = [0,0,0,0,0]; saveActiveSession(); UI.updateKeypad('18m'); }
export function submitRound70m() { if (!checkArrowSelection()) return; const session = state.sessions['70m']; const selected = session.uiState.selectedArrows70m; const hitLabels = selected.map(i => (state.currentArrowLabels[i] || i+1)); addScore({ hitCount: selected.length, hitLabels: hitLabels }); session.uiState.selectedArrows70m = []; saveActiveSession(); UI.updateKeypad('70m'); }
export function resetScore() { 
    const session = state.sessions[state.activeModuleId]; 
    if(session.totalArrows === 0) return; 
    const allSettings = JSON.parse(localStorage.getItem('kemankesBowSettings')) || {}; 
    const moduleSettings = allSettings[state.activeModuleId] || [{},{},{}]; 
    const bowName = moduleSettings[state.currentBowSlot]?.name || `Yay ${state.currentBowSlot+1}`; 
    // Detayları topla
    let detailedShots = [];
    let hitLabels = [];
    session.shotHistory.forEach(entry => {
        if (entry.detailedShots) detailedShots.push(...entry.detailedShots);
        else if (entry.hitLabels) hitLabels.push(...entry.hitLabels);
        else if (entry.label) detailedShots.push({ label: entry.label, score: entry.points });
    });

    const historyItem = { 
        date: new Date().toLocaleDateString('tr-TR'), time: new Date().toLocaleTimeString('tr-TR'), 
        arrows: session.totalArrows, score: session.score, bowName: bowName, note: prompt("Not:") || "",
        detailedShots: detailedShots.length > 0 ? detailedShots : undefined, hitLabels: hitLabels.length > 0 ? hitLabels : undefined
    }; 
    const key = 'kemankesHistory_' + state.activeModuleId; 
    const hist = JSON.parse(localStorage.getItem(key)) || []; 
    let currentMax = 0; 
    if (hist.length > 0) currentMax = Math.max(...hist.map(h => h.score)); 
    if (session.score > currentMax && session.score > 0) UI.triggerCelebration(session.score); 
    hist.unshift(historyItem); 
    
    try {
        localStorage.setItem(key, JSON.stringify(hist)); 
        const statsKey = `kemankesGlobalStats_${state.activeModuleId}_${state.currentBowSlot}`; 
        const globalStats = JSON.parse(localStorage.getItem(statsKey)) || {}; 
        Object.keys(session.arrowStats).forEach(label => { if(!globalStats[label]) globalStats[label] = { hits:0, shots:0, totalScore:0, headShots:0, sessions:0 }; const s = session.arrowStats[label]; globalStats[label].hits += s.hits; globalStats[label].shots += s.shots; globalStats[label].totalScore += s.totalScore; globalStats[label].headShots += s.headShots; globalStats[label].sessions += 1; }); 
        localStorage.setItem(statsKey, JSON.stringify(globalStats)); 
    } catch (e) {
        if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
            alert("⚠️ HAFIZA DOLU!\n\nGeçmiş kaydedilemedi. Lütfen eski kayıtları veya resimleri silin.");
            return;
        }
    }
    
    state.sessions[state.activeModuleId] = { score: 0, totalArrows: 0, currentRound: 1, arrowsInRound: 0, roundScores: new Array(moduleConfigs[state.activeModuleId].rounds).fill(0), isFinished: false, shotHistory: [], arrowStats: {}, arrowLabels: session.arrowLabels, uiState: { arrowStates18m: [0,0,0,0,0], selectedArrows70m: [] } }; 
    renderUI(); 
    UI.loadHistoryUI(); 
    saveActiveSession(); 
}
export function deleteHistoryItem(type, index) { if(!confirm('Silinsin mi?')) return; const key = 'kemankesHistory_' + type; const hist = JSON.parse(localStorage.getItem(key)) || []; hist.splice(index, 1); localStorage.setItem(key, JSON.stringify(hist)); if(state.activeModuleId === 'archive') UI.renderArchive(type); else UI.loadHistoryUI(); }
export function toggleArrowSelector(label) { if (state.isBrokenMode) { handleBrokenArrow(label); return; } const session = state.sessions[state.activeModuleId]; const limit = moduleConfigs[state.activeModuleId].arrowsPerRound; let labels = session.arrowLabels; const idx = labels.indexOf(label); if (idx > -1) labels.splice(idx, 1); else if (labels.length < limit) labels.push(label); labels.sort((a, b) => parseInt(a.replace(/^\D+/g, '')) - parseInt(b.replace(/^\D+/g, ''))); session.arrowLabels = labels; state.currentArrowLabels = labels; UI.renderArrowSelector(); if (state.activeModuleId === '70m') UI.updateKeypad('70m'); if (state.activeModuleId === '18m') { renderUI(); UI.updateKeypad('18m'); } if (labels.length >= limit) UI.toggleRightSidebar(false); }
export function clearArrowSelection() { if(confirm("Temizlensin mi?")) { state.sessions[state.activeModuleId].arrowLabels = []; state.currentArrowLabels = []; UI.renderArrowSelector(); if (state.activeModuleId === '70m') UI.updateKeypad('70m'); if (state.activeModuleId === '18m') { renderUI(); UI.updateKeypad('18m'); } UI.toggleRightSidebar(false); } }
export function toggleBrokenMode() { state.isBrokenMode = !state.isBrokenMode; const btn = document.getElementById('btnBrokenMode'); if(state.isBrokenMode) { btn.style.backgroundColor = '#d4af37'; btn.style.color = 'black'; btn.style.fontWeight = 'bold'; alert("Kırık oku seçin."); } else { btn.style.backgroundColor = '#333'; btn.style.color = 'white'; btn.style.fontWeight = 'normal'; } }
export function handleBrokenArrow(label) { if(confirm(`${label} sıfırlansın mı?`)) { const globalKey = `kemankesGlobalStats_${state.activeModuleId}_${state.currentBowSlot}`; const globalStats = JSON.parse(localStorage.getItem(globalKey)) || {}; if(globalStats[label]) { delete globalStats[label]; localStorage.setItem(globalKey, JSON.stringify(globalStats)); } alert("Sıfırlandı."); toggleBrokenMode(); } }
export function switchTargetFace(faceType, btnElement, render = true) { state.currentTargetFace = faceType; if (btnElement) { document.querySelectorAll('#module-target .archive-btn').forEach(b => b.classList.remove('active')); btnElement.classList.add('active'); } const config = targetConfigs[faceType]; if (config) document.getElementById('targetImg').setAttribute('href', config.image); renderArrowTray(); if(render) switchTargetRound(1); }
export function switchTargetRound(roundNum) { state.currentTargetRound = roundNum; if (!state.targetSessionData[state.currentTargetFace]) { state.targetSessionData[state.currentTargetFace] = Array(7).fill(null).map(() => []); } const currentFaceData = state.targetSessionData[state.currentTargetFace]; document.querySelectorAll('.t-round-btn').forEach((btn, index) => { if (index + 1 === roundNum) btn.classList.add('active'); else btn.classList.remove('active'); if (currentFaceData[index] && currentFaceData[index].length > 0) btn.classList.add('has-data'); else btn.classList.remove('has-data'); }); UI.renderTargetMarks(); renderArrowTray(); }
let activeDragEl = null; let dragGhost = null; let dragLabel = "";

// Mouse ve Touch desteği için event listener'ları güncelle
// --- MERCEK (LOUPE) MANTIĞI ---
let loupe = null;
let loupeSvg = null;

function showLoupe() {
    if (loupe) return;
    loupe = document.createElement('div');
    loupe.id = 'targetLoupe';
    loupe.style.position = 'fixed';
    loupe.style.width = '160px';
    loupe.style.height = '160px';
    loupe.style.borderRadius = '50%';
    loupe.style.border = '3px solid #d4af37';
    loupe.style.overflow = 'hidden';
    loupe.style.zIndex = '1001';
    loupe.style.backgroundColor = '#fff';
    loupe.style.pointerEvents = 'none';
    loupe.style.boxShadow = '0 0 15px rgba(0,0,0,0.5)';

    // Kırmızı Nokta (Crosshair)
    const crosshair = document.createElement('div');
    crosshair.style.position = 'absolute';
    crosshair.style.top = '50%';
    crosshair.style.left = '50%';
    crosshair.style.width = '6px';
    crosshair.style.height = '6px';
    crosshair.style.background = 'red';
    crosshair.style.borderRadius = '50%';
    crosshair.style.transform = 'translate(-50%, -50%)';
    crosshair.style.zIndex = '2';
    crosshair.style.border = '1px solid white';
    loupe.appendChild(crosshair);

    // SVG Klonla
    const originalSvg = document.getElementById('targetFace');
    if (originalSvg) {
        loupeSvg = originalSvg.cloneNode(true);
        loupeSvg.removeAttribute('id');
        loupeSvg.style.width = '100%';
        loupeSvg.style.height = '100%';
        loupeSvg.style.display = 'block';
        loupeSvg.style.backgroundColor = '#fff';
        loupe.appendChild(loupeSvg);
    }
    document.body.appendChild(loupe);
}

function updateLoupe(clientX, clientY) {
    if (!loupe || !loupeSvg) return;
    
    // Merceği parmağın yukarısına konumlandır
    loupe.style.left = (clientX - 80) + 'px';
    loupe.style.top = (clientY - 200) + 'px';

    const svg = document.getElementById('targetFace');
    if(!svg) return;
    const rect = svg.getBoundingClientRect();

    // Koordinatları SVG içine uyarla
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
        loupe.style.display = 'none';
        return;
    } else {
        loupe.style.display = 'block';
    }

    // SVG ViewBox dönüşümü (Zoom etkisi)
    const scaleX = 400 / rect.width;
    const scaleY = 400 / rect.height;
    const svgX = x * scaleX;
    const svgY = y * scaleY;

    const zoomSize = 130; // Daha küçük değer = Daha fazla zoom
    const vbX = svgX - (zoomSize / 2);
    const vbY = svgY - (zoomSize / 2);

    loupeSvg.setAttribute('viewBox', `${vbX} ${vbY} ${zoomSize} ${zoomSize}`);
}

function hideLoupe() {
    if (loupe) {
        loupe.remove();
        loupe = null;
        loupeSvg = null;
    }
}

function renderArrowTray() { let tray = document.getElementById('arrowTray'); if (!tray) { const wrapper = document.querySelector('.target-wrapper'); if (!wrapper) return; tray = document.createElement('div'); tray.id = 'arrowTray'; tray.className = 'arrow-tray'; wrapper.parentNode.insertBefore(tray, wrapper); } tray.innerHTML = ''; if (!state.targetSessionData[state.currentTargetFace]) { state.targetSessionData[state.currentTargetFace] = Array(7).fill(null).map(() => []); } const sourceModule = state.currentTargetFace === '70m' ? '70m' : '18m'; if (!state.sessions[sourceModule]) return; const moduleArrows = state.sessions[sourceModule].arrowLabels; const targetConfig = targetConfigs[state.currentTargetFace]; const count = targetConfig ? targetConfig.arrowCount : 5; const currentFaceData = state.targetSessionData[state.currentTargetFace]; const currentRoundData = currentFaceData[state.currentTargetRound - 1] || []; const usedLabels = currentRoundData.map(p => p.label); for (let i = 0; i < count; i++) { const label = moduleArrows[i] || (i + 1).toString(); const arrow = document.createElement('div'); arrow.className = 'draggable-arrow'; if (usedLabels.includes(label)) arrow.classList.add('used'); arrow.innerText = label; 
    // Touch Events
    arrow.addEventListener('touchstart', handleDragStart, {passive: false}); 
    arrow.addEventListener('touchmove', handleDragMove, {passive: false}); 
    arrow.addEventListener('touchend', handleDragEnd); 
    // Mouse Events
    arrow.addEventListener('mousedown', handleDragStart);
    tray.appendChild(arrow); } }

function handleDragStart(e) { e.preventDefault(); const clientX = e.touches ? e.touches[0].clientX : e.clientX; const clientY = e.touches ? e.touches[0].clientY : e.clientY; activeDragEl = e.target; dragLabel = activeDragEl.innerText; dragGhost = activeDragEl.cloneNode(true); dragGhost.style.position = 'fixed'; dragGhost.style.left = (clientX - 17) + 'px'; dragGhost.style.top = (clientY - 17) + 'px'; dragGhost.style.opacity = '0.8'; dragGhost.style.pointerEvents = 'none'; dragGhost.style.zIndex = '1000'; 
    document.addEventListener('touchmove', preventScroll, { passive: false });
    document.body.appendChild(dragGhost); 
    showLoupe(); // Merceği aç
    updateLoupe(clientX, clientY);
    if (!e.touches) { document.addEventListener('mousemove', handleDragMove); document.addEventListener('mouseup', handleDragEnd); } }

// ZOOM LOGIC GÜNCELLENDİ: MERCEK (LOUPE)
function handleDragMove(e) { 
    if (!dragGhost) return; 
    e.preventDefault(); 
    const clientX = e.touches ? e.touches[0].clientX : e.clientX; 
    const clientY = e.touches ? e.touches[0].clientY : e.clientY; 

    dragGhost.style.left = (clientX - 17) + 'px'; 
    dragGhost.style.top = (clientY - 17) + 'px'; 

    updateLoupe(clientX, clientY);
}

function handleDragEnd(e) { 
    if (!dragGhost) return; 
    const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX; 
    const clientY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY; 
    const svg = document.getElementById('targetFace'); 
    
    hideLoupe(); // Merceği kapat

    const rect = svg.getBoundingClientRect(); 
    if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) { 
        const pt = svg.createSVGPoint(); 
        pt.x = clientX; 
        pt.y = clientY; 
        // SVG CTM scale'i otomatik handle eder
        const svgP = pt.matrixTransform(svg.getScreenCTM().inverse()); 
        addShotToTarget(svgP.x, svgP.y, dragLabel); 
    } 
    document.body.removeChild(dragGhost); 
    dragGhost = null; 
    document.removeEventListener('touchmove', preventScroll, { passive: false });
    activeDragEl = null; 
    if (!e.touches) { document.removeEventListener('mousemove', handleDragMove); document.removeEventListener('mouseup', handleDragEnd); } 
}

function addShotToTarget(x, y, label) { let currentRoundData = state.targetSessionData[state.currentTargetFace][state.currentTargetRound - 1]; currentRoundData.push({x: x, y: y, label: label}); switchTargetRound(state.currentTargetRound); }
export function handleTargetClick(event) { if (event.target.closest && event.target.closest('g') && event.target.closest('g').hasAttribute('onclick')) return; const svg = document.getElementById('targetFace'); const pt = svg.createSVGPoint(); pt.x = event.clientX; pt.y = event.clientY; const svgP = pt.matrixTransform(svg.getScreenCTM().inverse()); let label = "?"; const currentRoundData = state.targetSessionData[state.currentTargetFace][state.currentTargetRound - 1]; const usedLabels = currentRoundData.map(p => p.label); const sourceModule = state.currentTargetFace === '70m' ? '70m' : '18m'; const moduleArrows = state.sessions[sourceModule].arrowLabels; const targetConfig = targetConfigs[state.currentTargetFace]; const count = targetConfig ? targetConfig.arrowCount : 5; for(let i=0; i<count; i++) { let lbl = moduleArrows[i] || (i+1).toString(); if(!usedLabels.includes(lbl)) { label = lbl; break; } } addShotToTarget(svgP.x, svgP.y, label); }
export function editTargetMark(index, event) { event.stopPropagation(); const currentData = state.targetSessionData[state.currentTargetFace][state.currentTargetRound - 1]; const newVal = prompt("Ok numarası:", currentData[index].label); if (newVal !== null) { if (newVal.trim() === "") currentData.splice(index, 1); else currentData[index].label = newVal; switchTargetRound(state.currentTargetRound); } }
export function undoTargetMark() { const currentData = state.targetSessionData[state.currentTargetFace][state.currentTargetRound - 1]; if (currentData && currentData.length > 0) { currentData.pop(); switchTargetRound(state.currentTargetRound); } }
export function resetTargetSession() {
    if(confirm("Tüm turları sıfırlamak istediğinize emin misiniz?")) {
        state.targetSessionData[state.currentTargetFace] = Array(7).fill(null).map(() => []);
        switchTargetRound(1);
        alert("Tüm turlar sıfırlandı ve veri girişine hazır.");
    }
}
export function saveTargetAnalysis() { 
    const note = document.getElementById('targetNoteInput').value; 
    const historyItem = { date: new Date().toLocaleDateString('tr-TR'), time: new Date().toLocaleTimeString('tr-TR'), face: state.currentTargetFace, rounds: state.targetSessionData[state.currentTargetFace], note: note }; 
    const savedHistory = JSON.parse(localStorage.getItem('kemankesTargetHistory')) || []; 
    savedHistory.unshift(historyItem); 
    try { localStorage.setItem('kemankesTargetHistory', JSON.stringify(savedHistory)); } catch(e) { if(e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') { alert("⚠️ HAFIZA DOLU!\n\nHedef analizi kaydedilemedi. Lütfen eski kayıtları silin."); return; } }
    state.targetSessionData[state.currentTargetFace] = Array(7).fill(null).map(() => []); saveActiveSession(); document.getElementById('targetNoteInput').value = ''; switchTargetRound(1); alert("Kaydedildi ve Sıfırlandı."); UI.loadTargetHistoryUI(); 
}
export function loadTargetAnalysisFromHistory(index) { const history = JSON.parse(localStorage.getItem('kemankesTargetHistory')) || []; const item = history[index]; if (!item) return; if (state.targetSessionData[state.currentTargetFace].some(r => r.length > 0)) if (!confirm("Mevcut silinecek?")) return; state.targetSessionData[state.currentTargetFace] = JSON.parse(JSON.stringify(item.rounds)); state.currentTargetFace = item.face; document.getElementById('targetNoteInput').value = item.note || ''; document.querySelectorAll('#module-target .archive-btn').forEach(btn => { if (btn.getAttribute('onclick').includes(`'${state.currentTargetFace}'`)) btn.classList.add('active'); else btn.classList.remove('active'); }); switchTargetFace(state.currentTargetFace, null); switchTargetRound(1); }

export function deleteTargetHistory(index) { if(!confirm("Silinsin mi?")) return; const history = JSON.parse(localStorage.getItem('kemankesTargetHistory')) || []; history.splice(index, 1); localStorage.setItem('kemankesTargetHistory', JSON.stringify(history)); UI.loadTargetHistoryUI(); }

export function toggleArrowBan(label, shouldBan, moduleType) { 
    const type = moduleType || state.activeModuleId;
    const bannedKey = `kemankesBanned_${type}_${state.currentBowSlot}`; 
    const reasonsKey = `kemankesBannedReasons_${type}_${state.currentBowSlot}`;
    
    let list = JSON.parse(localStorage.getItem(bannedKey)) || []; 
    let reasons = JSON.parse(localStorage.getItem(reasonsKey)) || {};

    if (shouldBan) { 
        if (!list.includes(label)) {
            const reason = prompt(`"${label}" numaralı oku neden karantinaya alıyorsun? (Örn: Tüy koptu, Yamuk)`, "Tüy hasarı");
            if (reason === null) return; // İptal edilirse işlem yapma
            list.push(label); 
            reasons[label] = reason;
        }
    } else { 
        list = list.filter(item => item !== label); 
        if(reasons[label]) delete reasons[label];
    } 
    
    localStorage.setItem(bannedKey, JSON.stringify(list)); 
    localStorage.setItem(reasonsKey, JSON.stringify(reasons));
    UI.renderArrowDetails(); 
}

export function resetArrowStats(label, moduleType) {
    const type = moduleType || state.activeModuleId;
    if(confirm(`${label} numaralı okun tüm istatistikleri silinecek. Onaylıyor musun?`)) {
        const globalKey = `kemankesGlobalStats_${type}_${state.currentBowSlot}`;
        const globalStats = JSON.parse(localStorage.getItem(globalKey)) || {};
        if(globalStats[label]) { delete globalStats[label]; localStorage.setItem(globalKey, JSON.stringify(globalStats)); }
        if(state.sessions[type] && state.sessions[type].arrowStats[label]) { delete state.sessions[type].arrowStats[label]; }
        UI.renderArrowDetails();
    }
}

export function clearArrowAnalysis() { if(confirm("Seçili yayın tüm istatistikleri silinsin mi?")) { localStorage.removeItem(`kemankesGlobalStats_${state.activeModuleId}_${state.currentBowSlot}`); UI.renderArrowAnalysis(state.activeModuleId); } }
export function switchBowSlot(slotIndex) { state.currentBowSlot = slotIndex; for(let i=0; i<3; i++) { const btn = document.getElementById(`bowSlot${i}`); if (i === slotIndex) { btn.classList.add('selected'); btn.style.backgroundColor = '#d4af37'; btn.style.color = '#000'; } else { btn.classList.remove('selected'); btn.style.backgroundColor = '#333'; btn.style.color = '#fff'; } } const allSettings = JSON.parse(localStorage.getItem('kemankesBowSettings')) || {}; const moduleSettings = allSettings[state.activeModuleId] || [{}, {}, {}]; const slotData = moduleSettings[slotIndex] || {}; document.getElementById('bowName').value = slotData.name || ''; document.getElementById('bowBrace').value = slotData.brace || ''; document.getElementById('bowNock').value = slotData.nock || ''; document.getElementById('bowFinger').value = slotData.finger || ''; }
export function saveBowSettings() { const allSettings = JSON.parse(localStorage.getItem('kemankesBowSettings')) || {}; if (!allSettings[state.activeModuleId]) allSettings[state.activeModuleId] = [{}, {}, {}]; const newData = { name: document.getElementById('bowName').value, brace: document.getElementById('bowBrace').value, nock: document.getElementById('bowNock').value, finger: document.getElementById('bowFinger').value }; allSettings[state.activeModuleId][state.currentBowSlot] = newData; localStorage.setItem('kemankesBowSettings', JSON.stringify(allSettings)); const btn = document.querySelector('#bowFormContent .btn-add-note'); const originalText = btn.innerText; btn.innerText = "✅ Kaydedildi"; btn.style.backgroundColor = "#4caf50"; setTimeout(() => { btn.innerText = originalText; btn.style.backgroundColor = "#d4af37"; }, 1500); }

// NOTLAR (FIXED - LOGIC İÇİNDE YÖNETİM)
let editingNoteIndex = null;
export function handleNoteImage(input) { if (input.files && input.files[0]) { const reader = new FileReader(); reader.onload = function(e) { const img = new Image(); img.onload = function() { const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d'); const MAX_WIDTH = 800; const MAX_HEIGHT = 800; let width = img.width; let height = img.height; if (width > height) { if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; } } else { if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; } } canvas.width = width; canvas.height = height; ctx.drawImage(img, 0, 0, width, height); const base64 = canvas.toDataURL('image/jpeg', 0.5); const editor = document.getElementById('noteEditor'); editor.focus(); document.execCommand('insertHTML', false, `<img src="${base64}"><br>`); input.value = ''; }; img.src = e.target.result; }; reader.readAsDataURL(input.files[0]); } }

// NOT KAYDETME (DÜZENLEME & YENİ EKLEME MANTIĞI)
export function saveNote() { 
    const title = document.getElementById('noteTitle').value; 
    const content = document.getElementById('noteEditor').innerHTML; 
    if (!title.trim() && !content.trim()) { alert("Başlık veya içerik girin."); return; } 
    
    const notes = JSON.parse(localStorage.getItem('kemankesNotes')) || []; 
    
    if (editingNoteIndex !== null) { 
        // Düzenleme Modu
        notes[editingNoteIndex].title = title; 
        notes[editingNoteIndex].text = content; 
        delete notes[editingNoteIndex].image; 
        alert("✅ Not başarıyla güncellendi.");
    } else { 
        // Yeni Kayıt Modu
        notes.unshift({ id: Date.now(), date: new Date().toLocaleDateString('tr-TR'), title: title, text: content }); 
        alert("🎉 Yeni not oluşturuldu.");
    } 
    
    try {
        localStorage.setItem('kemankesNotes', JSON.stringify(notes)); 
        UI.toggleNoteForm(false); 
        UI.renderNotes(); 
    } catch (e) {
        if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
            alert("⚠️ HAFIZA DOLU!\n\nNot kaydedilemedi. Lütfen eski notları veya resimleri silin.");
        }
    }
}

export function editNote(index) { const notes = JSON.parse(localStorage.getItem('kemankesNotes')) || []; const note = notes[index]; if (!note) return; editingNoteIndex = index; document.getElementById('noteTitle').value = note.title || ''; let content = note.text; if (note.image) content += `<br><img src="${note.image}">`; document.getElementById('noteEditor').innerHTML = content; toggleNoteForm(true); }
export function deleteNote(index) { if(!confirm("Silinsin mi?")) return; const notes = JSON.parse(localStorage.getItem('kemankesNotes')) || []; notes.splice(index, 1); localStorage.setItem('kemankesNotes', JSON.stringify(notes)); UI.renderNotes(); }

// --- ANTRENÖR MODÜLÜ LOGIC (YENİ: MODAL İLE EKLEME) ---
export function addSPT() {
    // Modalı aç
    UI.openSPTModal();
}

let sptImages = []; // Geçici resim depolama

export function handleSPTImage(input) {
    if (input.files) {
        sptImages = []; // Sıfırla
        const previewDiv = document.getElementById('sptImagePreview');
        previewDiv.innerHTML = '';
        
        Array.from(input.files).slice(0, 4).forEach(file => { // Max 4 dosya
            const reader = new FileReader();
            
            // GIF kontrolü: GIF ise canvas ile sıkıştırma yapma (animasyon bozulur)
            if (file.type === 'image/gif') {
                if (file.size > 2 * 1024 * 1024) { // 2MB üzeri uyarı
                    alert("⚠️ Uyarı: Yüklediğiniz GIF dosyası büyük (>2MB). Bu durum hafızayı çabuk doldurabilir.");
                }
                reader.onload = function(e) {
                    const base64 = e.target.result;
                    sptImages.push(base64);
                    
                    // Önizleme
                    const thumb = document.createElement('img');
                    thumb.src = base64;
                    thumb.style.width = '50px'; thumb.style.height = '50px'; thumb.style.objectFit = 'cover'; thumb.style.borderRadius = '4px';
                    previewDiv.appendChild(thumb);
                };
            } else {
                reader.onload = function(e) {
                    const img = new Image();
                    img.onload = function() {
                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');
                        const MAX_WIDTH = 400; // Küçük tutalım
                        const MAX_HEIGHT = 400;
                        let width = img.width;
                        let height = img.height;
                        if (width > height) { if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; } } else { if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; } }
                        canvas.width = width; canvas.height = height;
                        ctx.drawImage(img, 0, 0, width, height);
                        const base64 = canvas.toDataURL('image/jpeg', 0.5); // Hafıza tasarrufu
                        sptImages.push(base64);
                        
                        // Önizleme
                        const thumb = document.createElement('img');
                        thumb.src = base64;
                        thumb.style.width = '50px'; thumb.style.height = '50px'; thumb.style.objectFit = 'cover'; thumb.style.borderRadius = '4px';
                        previewDiv.appendChild(thumb);
                    };
                    img.src = e.target.result;
                };
            }
            reader.readAsDataURL(file);
        });
    }
}

export function saveSPT() {
    const name = document.getElementById('sptName').value;
    const desc = document.getElementById('sptDesc').value;
    
    if(!name) { alert("Hareket adı girin."); return; }
    
    const sptList = JSON.parse(localStorage.getItem('kemankesSPT')) || [];
    sptList.push({name, desc, images: sptImages});
    
    try {
        localStorage.setItem('kemankesSPT', JSON.stringify(sptList));
        document.getElementById('sptModal').style.display = 'none';
        UI.renderSPT();
        sptImages = []; // Temizle
    } catch (e) {
        if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
            alert("⚠️ HAFIZA DOLU!\n\nHareket kaydedilemedi. Lütfen eski kayıtları veya resimleri silin.");
        }
    }
}

export function deleteSPT(index) {
    if(!confirm("Silinsin mi?")) return;
    const sptList = JSON.parse(localStorage.getItem('kemankesSPT')) || [];
    sptList.splice(index, 1);
    localStorage.setItem('kemankesSPT', JSON.stringify(sptList));
    UI.renderSPT();
}

export function moveSPT(index, direction) {
    const list = JSON.parse(localStorage.getItem('kemankesSPT')) || [];
    // Yukarı taşıma (-1) veya Aşağı taşıma (+1)
    if (direction === -1 && index > 0) {
        [list[index], list[index - 1]] = [list[index - 1], list[index]];
    } else if (direction === 1 && index < list.length - 1) {
        [list[index], list[index + 1]] = [list[index + 1], list[index]];
    }
    localStorage.setItem('kemankesSPT', JSON.stringify(list));
    UI.renderSPT();
}

// --- KRONOMETRE & SAYAÇ MANTIĞI ---
let timerInterval = null;
let timerSeconds = 0;
let isTimerRunning = false;
let isCountdownMode = false;

export function updateTimerUI() {
    const display = document.getElementById('timerDisplay');
    if (!display) return;
    
    const m = Math.floor(timerSeconds / 60).toString().padStart(2, '0');
    const s = (timerSeconds % 60).toString().padStart(2, '0');
    display.innerText = `${m}:${s}`;
}

export function startTimer() {
    if (isTimerRunning) return;

    const input = document.getElementById('timerInput');
    
    // İlk başlatma veya sıfırdan başlatma
    if (timerSeconds === 0 && !isCountdownMode) {
        const val = input ? parseInt(input.value) : 0;
        if (!isNaN(val) && val > 0) {
            isCountdownMode = true;
            timerSeconds = val;
        } else {
            isCountdownMode = false;
            timerSeconds = 0;
        }
    }

    isTimerRunning = true;
    
    timerInterval = setInterval(() => {
        if (isCountdownMode) {
            timerSeconds--;
            if (timerSeconds <= 0) {
                stopTimer();
                timerSeconds = 0;
                // Süre doldu uyarısı
                const display = document.getElementById('timerDisplay');
                if(display) {
                    display.style.color = '#f44336';
                    display.innerText = "00:00";
                }
                setTimeout(() => alert("⏰ Süre Doldu!"), 100);
                isCountdownMode = false; 
                return;
            }
        } else {
            timerSeconds++;
        }
        updateTimerUI();
    }, 1000);
    
    updateTimerUI(); // Hemen güncelle
}

export function stopTimer() {
    clearInterval(timerInterval);
    isTimerRunning = false;
}

export function resetTimer() {
    stopTimer();
    timerSeconds = 0;
    isCountdownMode = false;
    updateTimerUI();
    const display = document.getElementById('timerDisplay');
    if(display) display.style.color = '#d4af37';
    const input = document.getElementById('timerInput');
    if(input) input.value = '';
}

// --- DRILL (GÖREV) YÖNETİMİ ---
export function openDrillModal() {
    document.getElementById('newDrillInput').value = '';
    document.getElementById('drillModal').style.display = 'flex';
    document.getElementById('newDrillInput').focus();
}

export function saveDrill() {
    const input = document.getElementById('newDrillInput');
    const val = input.value.trim();
    if (!val) return;

    const drills = JSON.parse(localStorage.getItem('kemankesDrills')) || [];
    drills.push(val);
    localStorage.setItem('kemankesDrills', JSON.stringify(drills));
    
    document.getElementById('drillModal').style.display = 'none';
    UI.renderDrills(); // Listeyi yenile
}

export function deleteDrill(index) {
    if(!confirm("Bu görev listeden silinsin mi?")) return;
    const drills = JSON.parse(localStorage.getItem('kemankesDrills')) || [];
    drills.splice(index, 1);
    localStorage.setItem('kemankesDrills', JSON.stringify(drills));
    UI.renderDrills();
}

export function pickRandomDrill() {
    const drills = JSON.parse(localStorage.getItem('kemankesDrills')) || [];
    if (drills.length === 0) {
        document.getElementById('drillDisplay').innerText = "Liste boş!";
        return;
    }
    const random = drills[Math.floor(Math.random() * drills.length)];
    
    // Animasyonlu efekt
    const display = document.getElementById('drillDisplay');
    display.style.opacity = 0;
    setTimeout(() => {
        display.innerText = random;
        display.style.opacity = 1;
    }, 200);
}

function preventScroll(e) {
    e.preventDefault();
}

// =======================================================
// [ÖNEMLİ] FONKSİYONLARI DIŞARIYA AÇ (ZORLA)
// =======================================================
window.switchModule = switchModule;
window.saveNote = saveNote;
window.resetScore = resetScore;
window.toggleNoteForm = UI.toggleNoteForm;
window.handleNoteImage = handleNoteImage;
window.editNote = editNote;
window.deleteNote = deleteNote;
window.openNoteDetail = UI.openNoteDetail;
window.openImageModal = UI.openImageModal;
window.showMatchStats = UI.showMatchStats;
window.openBowSettings = UI.openBowSettings;
window.switchBowSlot = switchBowSlot;
window.saveBowSettings = saveBowSettings;
window.toggleRightSidebar = UI.toggleRightSidebar;
window.addScore = addScore;
window.undoLastShot = undoLastShot;
window.submitRound18m = submitRound18m;
window.submitRound70m = submitRound70m;
window.toggleArrow18m = toggleArrow18m;
window.toggleArrow70m = toggleArrow70m;
window.switchTargetFace = switchTargetFace;
window.switchTargetRound = switchTargetRound;
window.handleTargetClick = handleTargetClick;
window.undoTargetMark = undoTargetMark;
window.resetTargetSession = resetTargetSession;
window.saveTargetAnalysis = saveTargetAnalysis;
window.loadTargetAnalysisFromHistory = loadTargetAnalysisFromHistory;
window.deleteTargetHistory = deleteTargetHistory;
window.renderArrowAnalysis = UI.renderArrowAnalysis;
window.clearArrowAnalysis = clearArrowAnalysis;
window.renderArchive = UI.renderArchive;
window.deleteHistoryItem = deleteHistoryItem;
window.toggleTheme = UI.toggleTheme;
window.toggleArrowSelector = toggleArrowSelector;
window.clearArrowSelection = clearArrowSelection;
window.toggleBrokenMode = toggleBrokenMode;
window.editTargetMark = editTargetMark;
window.toggleArrowBan = toggleArrowBan;
window.resetArrowStats = resetArrowStats;
window.showArrowHeatmap = UI.showArrowHeatmap;
window.updateSimulation = UI.updateSimulation;
window.renderArrowDetails = UI.renderArrowDetails;
window.renderNotes = UI.renderNotes;
window.calculateFOC = UI.calculateFOC;
// YENİ EXPORTLAR
window.filterArchive = UI.filterArchive;
window.renderDrills = UI.renderDrills;
window.renderSPT = UI.renderSPT;
window.addSPT = addSPT;
window.saveSPT = saveSPT;
window.handleSPTImage = handleSPTImage;
window.deleteSPT = deleteSPT;
window.moveSPT = moveSPT; // Yeni fonksiyonu dışarı aç
window.startTimer = startTimer;
window.stopTimer = stopTimer;
window.resetTimer = resetTimer;
window.updateTimerUI = updateTimerUI;
window.openDrillModal = openDrillModal;
window.saveDrill = saveDrill;
window.deleteDrill = deleteDrill;
window.pickRandomDrill = pickRandomDrill;
window.startCompass = window.startCompass; // Weather.js'den gelecek

// Drag & Drop Handlers for Notes (Global)
window.handleDragStartDesktop = function(e) { this.dataset.dragSrcIndex = this.dataset.index; this.style.opacity = '0.4'; e.dataTransfer.effectAllowed = 'move'; };
window.handleDragOverDesktop = function(e) { if (e.preventDefault) e.preventDefault(); return false; };
window.handleDropDesktop = function(e) { if (e.stopPropagation) e.stopPropagation(); const dragSrcIndex = document.querySelector('.note-card[style*="opacity: 0.4"]')?.dataset.index; const dropIndex = this.dataset.index; if (dragSrcIndex && dragSrcIndex !== dropIndex) { const notes = JSON.parse(localStorage.getItem('kemankesNotes')) || []; const item = notes.splice(dragSrcIndex, 1)[0]; notes.splice(dropIndex, 0, item); localStorage.setItem('kemankesNotes', JSON.stringify(notes)); UI.renderNotes(); } return false; };
window.handleDragEndDesktop = function(e) { this.style.opacity = '1'; };
window.handleTouchStartMobile = function(e) { e.preventDefault(); const card = this.closest('.note-card'); card.style.opacity = '0.5'; card.style.transform = 'scale(0.95)'; card.style.zIndex = '1000'; window.activeTouchCard = card; };
window.handleTouchMoveMobile = function(e) { e.preventDefault(); if (!window.activeTouchCard) return; const touch = e.touches[0]; const elementUnderFinger = document.elementFromPoint(touch.clientX, touch.clientY); const cardUnderFinger = elementUnderFinger?.closest('.note-card'); if (cardUnderFinger && cardUnderFinger !== window.activeTouchCard) { const list = document.getElementById('notesList'); const cards = Array.from(list.children); const fromIndex = cards.indexOf(window.activeTouchCard); const toIndex = cards.indexOf(cardUnderFinger); if (fromIndex < toIndex) list.insertBefore(window.activeTouchCard, cardUnderFinger.nextSibling); else list.insertBefore(window.activeTouchCard, cardUnderFinger); } };
window.handleTouchEndMobile = function(e) { if (!window.activeTouchCard) return; window.activeTouchCard.style.opacity = '1'; window.activeTouchCard.style.transform = 'none'; window.activeTouchCard.style.zIndex = ''; const list = document.getElementById('notesList'); const newOrderCards = Array.from(list.querySelectorAll('.note-card')); const notes = JSON.parse(localStorage.getItem('kemankesNotes')) || []; const newNotesArray = []; newOrderCards.forEach(card => { const oldIndex = card.dataset.index; newNotesArray.push(notes[oldIndex]); }); localStorage.setItem('kemankesNotes', JSON.stringify(newNotesArray)); UI.renderNotes(); window.activeTouchCard = null; };

// --- SPT (GÜÇ KONDİSYON) SÜRÜKLE BIRAK HANDLERS ---
window.handleDragStartSPT = function(e) { this.dataset.dragSrcIndex = this.dataset.index; this.style.opacity = '0.4'; e.dataTransfer.effectAllowed = 'move'; };
window.handleDragOverSPT = function(e) { if (e.preventDefault) e.preventDefault(); return false; };
window.handleDropSPT = function(e) { 
    if (e.stopPropagation) e.stopPropagation(); 
    const dragSrcIndex = document.querySelector('.spt-card[style*="opacity: 0.4"]')?.dataset.index; 
    const dropIndex = this.dataset.index; 
    if (dragSrcIndex && dragSrcIndex !== dropIndex) { 
        const list = JSON.parse(localStorage.getItem('kemankesSPT')) || []; 
        const item = list.splice(dragSrcIndex, 1)[0]; 
        list.splice(dropIndex, 0, item); 
        localStorage.setItem('kemankesSPT', JSON.stringify(list)); 
        UI.renderSPT(); 
    } 
    return false; 
};
window.handleDragEndSPT = function(e) { this.style.opacity = '1'; };

// SPT Mobil Dokunmatik (Touch) Desteği
window.handleTouchStartSPTMobile = function(e) { e.preventDefault(); const card = this.closest('.spt-card'); card.style.opacity = '0.5'; card.style.transform = 'scale(0.95)'; card.style.zIndex = '1000'; window.activeTouchCardSPT = card; };
window.handleTouchMoveSPTMobile = function(e) { 
    e.preventDefault(); 
    if (!window.activeTouchCardSPT) return; 
    const touch = e.touches[0]; 
    const elementUnderFinger = document.elementFromPoint(touch.clientX, touch.clientY); 
    const cardUnderFinger = elementUnderFinger?.closest('.spt-card'); 
    if (cardUnderFinger && cardUnderFinger !== window.activeTouchCardSPT) { 
        const list = document.getElementById('sptListContainer'); 
        const cards = Array.from(list.children); 
        const fromIndex = cards.indexOf(window.activeTouchCardSPT); 
        const toIndex = cards.indexOf(cardUnderFinger); 
        if (fromIndex < toIndex) list.insertBefore(window.activeTouchCardSPT, cardUnderFinger.nextSibling); 
        else list.insertBefore(window.activeTouchCardSPT, cardUnderFinger); 
    } 
};
window.handleTouchEndSPTMobile = function(e) { 
    if (!window.activeTouchCardSPT) return; 
    window.activeTouchCardSPT.style.opacity = '1'; 
    window.activeTouchCardSPT.style.transform = 'none'; 
    window.activeTouchCardSPT.style.zIndex = ''; 
    const list = document.getElementById('sptListContainer'); 
    const newOrderCards = Array.from(list.querySelectorAll('.spt-card')); 
    const oldList = JSON.parse(localStorage.getItem('kemankesSPT')) || []; 
    const newList = []; 
    newOrderCards.forEach(card => { 
        const oldIndex = card.dataset.index; 
        newList.push(oldList[oldIndex]); 
    }); 
    localStorage.setItem('kemankesSPT', JSON.stringify(newList)); 
    UI.renderSPT(); 
    window.activeTouchCardSPT = null; 
};
