// js/ui.js - V3.2 (UI MODÜLÜ)
import { state, moduleConfigs, targetConfigs } from './data.js';

console.log("🎨 UI Modülü Yüklendi...");

// =======================================================
// 1. GENEL UI İŞLEMLERİ
// =======================================================

export function renderUI() {
    if (!state.sessions || !state.sessions[state.activeModuleId]) return;
    
    const session = state.sessions[state.activeModuleId];
    const config = moduleConfigs[state.activeModuleId];

    const setTxt = (id, val) => { const el = document.getElementById(id); if(el) el.innerText = val; };
    setTxt('moduleTitle', config.name);
    setTxt('totalScore', session.score);
    setTxt('turDisplay', session.currentRound);
    setTxt('okDisplay', session.arrowsInRound + "/" + config.arrowsPerRound);

    // --- GHOST MODE (HAYALET OKÇU) ---
    const ghostEl = document.getElementById('ghostScore');
    if (ghostEl) {
        const history = JSON.parse(localStorage.getItem('kemankesHistory_' + state.activeModuleId)) || [];
        const maxScore = history.length > 0 ? Math.max(...history.map(h => h.score)) : 0;
        
        if (maxScore > 0) {
            let diff = session.score - maxScore;
            ghostEl.innerHTML = `<span style="color:#666; font-size:12px;">🏆 Rekor: ${maxScore}</span>`;
            if (session.isFinished) {
                const diffSign = diff > 0 ? "+" : "";
                const color = diff >= 0 ? "#4caf50" : "#f44336";
                ghostEl.innerHTML += ` <span style="color:${color}; font-weight:bold; font-size:12px;">(${diffSign}${diff})</span>`;
            }
        } else {
            ghostEl.innerHTML = "";
        }
    }

    const grid = document.getElementById('roundsGrid');
    if(grid) {
        grid.innerHTML = ''; 
        grid.style.gridTemplateColumns = `repeat(${state.activeModuleId === '70m' ? 6 : 7}, 1fr)`;
        for (let i = 0; i < config.rounds; i++) {
            const cell = document.createElement('div'); 
            cell.className = 'round-cell';
            if (i + 1 === session.currentRound && !session.isFinished) cell.classList.add('active');
            let scoreText = "-";
            if (i < session.currentRound - 1 || session.isFinished || (i === session.currentRound - 1 && session.arrowsInRound > 0)) {
                scoreText = session.roundScores[i];
            } else if (i === session.currentRound - 1 && session.arrowsInRound === 0) {
                scoreText = "0";
            }
            cell.innerHTML = `<span class="round-num">${i+1}</span><span class="round-score">${scoreText}</span>`;
            grid.appendChild(cell);
        }
    }
    renderArrowSelector();
}

export function loadHistoryUI() {
    const savedHistory = JSON.parse(localStorage.getItem('kemankesHistory_' + state.activeModuleId)) || [];
    const list = document.getElementById('historyList'); 
    if(!list) return;
    
    list.innerHTML = ''; 
    
    if (savedHistory.length === 0) {
        list.innerHTML = '<div style="text-align:center; color:#666;">Henüz kayıt yok.</div>';
        return;
    }

    // Yıllara göre grupla
    const grouped = {};
    savedHistory.forEach((item, index) => {
        let year = "Tarihsiz";
        if (item.date) {
            const parts = item.date.split('.');
            if (parts.length === 3) year = parts[2];
        }
        if (!grouped[year]) grouped[year] = [];
        grouped[year].push({ ...item, originalIndex: index });
    });

    const years = Object.keys(grouped).sort((a, b) => b - a); // Yeniden eskiye

    years.forEach(year => {
        // Yıl Ortalaması Hesapla
        const yearItems = grouped[year];
        let totalScore = 0;
        let totalArrows = 0;
        yearItems.forEach(i => {
            totalScore += i.score;
            totalArrows += i.arrows;
        });
        const yearAvg = totalArrows > 0 ? (totalScore / totalArrows).toFixed(2) : "0.00";

        const yearGroup = document.createElement('div');
        yearGroup.style.marginBottom = '10px';
        
        // Başlık (Accordion Header)
        const header = document.createElement('div');
        header.style.cssText = "background:#222; padding:10px; border-radius:8px; cursor:pointer; display:flex; justify-content:space-between; align-items:center; border:1px solid #333; margin-bottom:5px;";
        header.innerHTML = `<span style="font-weight:bold; color:#d4af37;">📅 ${year} <span style="font-size:11px; color:#aaa;">(Ort: ${yearAvg})</span></span> <span style="font-size:12px; color:#666;">(${grouped[year].length} Kayıt) ▼</span>`;
        
        // İçerik (Accordion Content)
        const contentDiv = document.createElement('div');
        contentDiv.style.display = 'none'; 
        contentDiv.style.paddingLeft = '5px';

        header.onclick = () => {
            const isOpen = contentDiv.style.display === 'block';
            contentDiv.style.display = isOpen ? 'none' : 'block';
            header.querySelector('span:last-child').innerText = `(${grouped[year].length} Kayıt) ${isOpen ? '▼' : '▲'}`;
        };

        grouped[year].forEach(item => {
            const newItem = document.createElement('div'); 
            newItem.className = 'history-item';
            const avg = item.arrows > 0 ? (item.score / item.arrows).toFixed(2) : "0.00";
            const bowInfo = item.bowName ? `<br><span style="font-size:11px; color:#d4af37;">🏹 ${item.bowName}</span>` : '';
            const dateDisplay = item.date || "Tarihsiz";
            
            newItem.innerHTML = `
                <div>
                    <div style="color:#d4af37">${dateDisplay} ${item.time}</div>
                    <div style="font-size:12px; color:#888;">Ort: ${avg} (${item.arrows} ok)${bowInfo}</div>
                </div>
                <div style="display:flex; align-items:center;">
                    <span style="font-weight:bold;">${item.score} Puan</span>
                    <button class="btn-delete-record" onclick="window.deleteHistoryItem('${state.activeModuleId}', ${item.originalIndex})">Sil</button>
                </div>`;
            contentDiv.appendChild(newItem);
        });

        yearGroup.appendChild(header);
        yearGroup.appendChild(contentDiv);
        list.appendChild(yearGroup);
    });

    // İlk yılı otomatik aç
    if(list.firstChild && list.firstChild.lastChild) {
        list.firstChild.lastChild.style.display = 'block';
        list.firstChild.firstChild.querySelector('span:last-child').innerText = list.firstChild.firstChild.querySelector('span:last-child').innerText.replace('▼', '▲');
    }
}

export function getButtonStyle18m(val) {
    if (val === 0) return { style: 'background-color: #333; color: #fff; border-color: #444;', text: '<span style="font-size:10px; color:#888;">(Miss)</span>' };
    if (val === 1) return { style: 'background-color: #e0e0e0; color: #000; border-color: #fff;', text: '<span style="font-size:10px; color:#000;">(Hit - 1)</span>' };
    if (val === 3) return { style: 'background-color: #d4af37; color: #000; border-color: #b5952f;', text: '<span style="font-size:10px; color:#000;">(HeadShot - 3)</span>' };
    return { style: '', text: '' };
}

export function updateKeypad(moduleId) {
    const keypad = document.getElementById('keypad'); 
    if(!keypad) return;
    
    const config = moduleConfigs[moduleId]; 
    const session = state.sessions[moduleId];
    keypad.innerHTML = ''; 
    keypad.className = 'keypad';
    
    const getLbl = (idx) => (state.currentArrowLabels[idx] || (idx + 1).toString());

    if (config.inputType === 'round_18m') {
        keypad.classList.add('numeric'); 
        let html = '';
        for(let i=1; i<=config.arrowsPerRound; i++) {
            const savedState = session.uiState.arrowStates18m[i-1] || 0; 
            const style = getButtonStyle18m(savedState);
            html += `<button id="arrowBtn18m_${i-1}" onclick="window.toggleArrow18m(${i-1})" style="${style.style}">${getLbl(i-1)}<br>${style.text}</button>`;
        }
        html += `<button class="btn-delete-slot" onclick="window.undoLastShot()">Sil ⌫</button>
                 <button class="btn-reset" onclick="window.submitRound18m()" style="grid-column: span 2;">Kaydet & İlerle</button>
                 <button class="btn-reset" onclick="window.resetScore()" style="grid-column: span 2; background-color:#333;">Sıfırla & Kaydet</button>`;
        keypad.style.gridTemplateColumns = "repeat(2, 1fr)"; 
        keypad.innerHTML = html;
    } else if (config.inputType === 'round') {
        keypad.classList.add('numeric'); 
        let html = '';
        for(let i=1; i<=config.arrowsPerRound; i++) {
            const isSel = session.uiState.selectedArrows70m.includes(i-1);
            const style = isSel ? 'background-color: #d4af37; color: #000;' : 'background-color: #333; color: #fff;';
            const txt = isSel ? '<span style="font-size:10px; color:#000;">(Hit)</span>' : '<span style="font-size:10px; color:#888;">(Miss)</span>';
            html += `<button id="arrowBtn70m_${i-1}" onclick="window.toggleArrow70m(${i-1})" style="font-size:14px; padding:10px; ${style}">${getLbl(i-1)}<br>${txt}</button>`;
        }
        html += `<button class="btn-reset" onclick="window.submitRound70m()" style="grid-column: span 3;">Kaydet & İlerle</button>
                 <button class="btn-reset" onclick="window.resetScore()" style="grid-column: span 3; background-color:#333;">Sıfırla & Kaydet</button>
                 <div style="grid-column: span 3; text-align: center; color: #666; font-size: 12px; margin: 5px 0;">-------- hızlı giriş --------</div>
                 <button class="btn-undo" onclick="window.undoLastShot()" style="grid-column: span 3; padding:10px; font-size:16px;">Sil</button>`;
        [7,8,9,4,5,6,1,2,3].forEach(n => html += `<button onclick="window.addScore(${n})" style="padding:10px; font-size:18px;">${n}</button>`);
        html += `<button onclick="window.addScore(0)" style="grid-column: 2; padding:10px; font-size:18px;">0</button>`;
        keypad.style.gridTemplateColumns = "repeat(3, 1fr)"; 
        keypad.innerHTML = html;
    }
}

export function toggleRightSidebar(forceState) { 
    const sidebar = document.getElementById('arrowSelectorSidebar'); 
    if(!sidebar) return; 
    if (typeof forceState === 'boolean') { 
        if (forceState) sidebar.classList.add('show'); 
        else sidebar.classList.remove('show'); 
    } else { 
        sidebar.classList.toggle('show'); 
    } 
}

export function generateArrowSelectorButtons(prefix) { 
    const sidebar = document.getElementById('arrowSelectorSidebar'); 
    if(!sidebar) return; 
    sidebar.innerHTML = ''; 
    
    const controlsDiv = document.createElement('div'); 
    controlsDiv.style.cssText = 'display:flex; flex-direction:column; gap:8px; margin-bottom:15px; width:100%; align-items:center; border-bottom:1px solid #333; padding-bottom:10px;'; 
    
    const bowLabel = document.createElement('label'); 
    bowLabel.innerText = "Aktif Yay:"; 
    bowLabel.style.cssText = "color:#888; font-size:11px; align-self:flex-start; margin-left:5px;"; 
    controlsDiv.appendChild(bowLabel); 
    
    const bowSelect = document.createElement('select'); 
    bowSelect.style.cssText = "background:#333; color:#fff; border:1px solid #555; padding:5px; border-radius:4px; width:95%; margin-bottom:10px; font-size:12px;"; 
    
    const allSettings = JSON.parse(localStorage.getItem('kemankesBowSettings')) || {}; 
    const moduleSettings = allSettings[state.activeModuleId] || [{},{},{}]; 
    
    moduleSettings.forEach((slot, idx) => { 
        const opt = document.createElement('option'); 
        opt.value = idx; 
        opt.text = slot.name || `Yay ${idx+1}`; 
        if(idx === state.currentBowSlot) opt.selected = true; 
        bowSelect.appendChild(opt); 
    }); 
    
    bowSelect.onchange = (e) => { 
        window.switchBowSlot(parseInt(e.target.value)); 
        renderArrowSelector(); 
    }; 
    controlsDiv.appendChild(bowSelect); 
    
    const btnClear = document.createElement('button'); 
    btnClear.className = 'arrow-select-btn center'; 
    btnClear.style.cssText = 'border-radius:8px; width:90%; fontSize:12px; background-color:#8b0000;'; 
    btnClear.innerText = 'Seçimi Sıfırla'; 
    btnClear.onclick = () => window.clearArrowSelection(); 
    controlsDiv.appendChild(btnClear); 
    
    const btnBroken = document.createElement('button'); 
    btnBroken.id = 'btnBrokenMode'; 
    btnBroken.className = 'arrow-select-btn center'; 
    btnBroken.style.cssText = 'border-radius:8px; width:90%; fontSize:12px; background-color:#333;'; 
    btnBroken.innerText = '🛠️ Kırıldı'; 
    btnBroken.onclick = () => window.toggleBrokenMode(); 
    controlsDiv.appendChild(btnBroken); 
    
    sidebar.appendChild(controlsDiv); 
    
    for(let i=1; i<=25; i++) { 
        const btn = document.createElement('button'); 
        btn.className = 'arrow-select-btn'; 
        btn.id = `arrow-sel-${prefix}${i}`; 
        btn.innerText = `${prefix}${i}`; 
        btn.onclick = () => window.toggleArrowSelector(`${prefix}${i}`); 
        sidebar.appendChild(btn); 
    } 
}

export function renderArrowSelector() { 
    const session = state.sessions[state.activeModuleId]; 
    if(!session) return; 
    const labels = session.arrowLabels; 
    const prefix = state.activeModuleId === '18m' ? 'K' : 'B'; 
    const btnSelect = document.getElementById('btnArrowSelect'); 
    
    if (btnSelect) { 
        const allSettings = JSON.parse(localStorage.getItem('kemankesBowSettings')) || {}; 
        const moduleSettings = allSettings[state.activeModuleId] || [{},{},{}]; 
        const bowName = moduleSettings[state.currentBowSlot]?.name || `Yay ${state.currentBowSlot+1}`; 
        
        if (labels.length === 0) { 
            btnSelect.innerHTML = `⚠️ DİKKAT OK SEÇİNİZ!<br><span style='font-size:10px; font-weight:normal;'>(${bowName})</span>`; 
            btnSelect.style.borderColor = "#f44336"; 
            btnSelect.style.color = "#f44336"; 
            btnSelect.style.backgroundColor = "rgba(244, 67, 54, 0.1)"; 
        } else { 
            btnSelect.innerHTML = `🏹 Ok Seç<br><span style='font-size:10px; font-weight:normal;'>(${bowName})</span>`; 
            btnSelect.style.borderColor = ""; 
            btnSelect.style.color = ""; 
            btnSelect.style.backgroundColor = ""; 
        } 
    } 
    
    for (let i = 1; i <= 25; i++) { 
        const btn = document.getElementById(`arrow-sel-${prefix}${i}`); 
        if (btn) { 
            if (labels.includes(`${prefix}${i}`)) btn.classList.add('selected'); 
            else btn.classList.remove('selected'); 
        } 
    } 
}

export function triggerCelebration(score) { 
    const overlay = document.getElementById('celebration-overlay'); 
    const scoreDisplay = document.getElementById('record-score-display'); 
    if(scoreDisplay) scoreDisplay.innerText = score; 
    
    if(overlay) { 
        overlay.style.display = 'flex'; 
        const colors = ['#d4af37', '#f44336', '#2196f3', '#4caf50', '#ffeb3b']; 
        
        for (let i = 0; i < 100; i++) { 
            const confetti = document.createElement('div'); 
            confetti.className = 'confetti'; 
            confetti.style.left = Math.random() * 100 + 'vw'; 
            confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)]; 
            confetti.style.opacity = Math.random(); 
            confetti.animate([ 
                { transform: `translate(0, 0) rotate(0deg)`, opacity: 1 }, 
                { transform: `translate(${Math.random()*100 - 50}px, 100vh) rotate(${Math.random()*720}deg)`, opacity: 0 } 
            ], { duration: Math.random() * 2000 + 2000, easing: 'linear', fill: 'forwards' }); 
            overlay.appendChild(confetti); 
        } 
        
        setTimeout(() => { 
            overlay.style.display = 'none'; 
            const card = overlay.querySelector('.record-card'); 
            overlay.innerHTML = ''; 
            if(card) overlay.appendChild(card); 
        }, 4000); 
    } 
}

export function toggleTheme() { 
    document.body.classList.toggle('light-mode'); 
    const isLight = document.body.classList.contains('light-mode'); 
    localStorage.setItem('kemankesTheme', isLight ? 'light' : 'dark'); 
}

// =======================================================
// 2. GRAFİK & ARŞİV (GÜNCELLENDİ: FİLTRE & FILL)
// =======================================================

export function drawChart(data) { 
    const container = document.getElementById('chartContainer'); 
    if(!container) return; 
    container.innerHTML = ''; 
    container.style.position = 'relative'; // Overlay için relative
    container.style.overflow = 'hidden';   // Container taşmasın
    
    // 1. Overlay (Sabit Etiketler için)
    const overlay = document.createElement('div');
    overlay.style.position = 'absolute';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.pointerEvents = 'none'; // Tıklamaları arkaya geçir
    overlay.style.zIndex = '10';
    container.appendChild(overlay);

    // 2. Scroll Wrapper (Grafik bunun içinde olacak)
    const scrollWrapper = document.createElement('div');
    scrollWrapper.style.width = '100%';
    scrollWrapper.style.height = '100%';
    scrollWrapper.style.overflowX = 'auto'; // Kaydırma burada olacak
    scrollWrapper.style.overflowY = 'hidden';
    container.appendChild(scrollWrapper);

    if (data.length === 0) { 
        scrollWrapper.innerHTML = '<div style="color:#666; text-align:center; padding-top:80px;">Veri Yok</div>'; 
        return; 
    } 
    
    const scores = data.map(d => d.score); 
    const maxScore = Math.max(...scores, 10); 
    const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length); 
    
    const containerWidth = container.clientWidth;
    const height = container.clientHeight - 20; 
    const paddingTop = 30; 
    const paddingBottom = 30; 
    const chartHeight = height - paddingTop - paddingBottom; 
    
    let totalWidth;
    let pointGap;
    let dotRadius = 5;

    if (currentArchiveFilter === 'all' || currentArchiveFilter === 'season') {
        // FIT MODE (Ekrana Sığdır)
        totalWidth = containerWidth;
        pointGap = data.length > 1 ? (totalWidth - 40) / (data.length - 1) : 0;
        dotRadius = data.length > 50 ? 3 : 5; // Veri çoksa noktaları küçült
    } else {
        // SCROLL MODE (Kaydırmalı)
        if (currentArchiveFilter === '1m') {
            pointGap = 30;
        } else if (currentArchiveFilter === '6m') {
            pointGap = 15; // 6 Ay: Daha sıkışık görünüm
            dotRadius = 3;
        } else {
            pointGap = 60; // 1 Hafta (Varsayılan)
        }
        
        totalWidth = Math.max(containerWidth, (data.length - 1) * pointGap + 60);
    }

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg"); 
    svg.setAttribute("width", totalWidth); 
    svg.setAttribute("height", height); 
    svg.setAttribute("viewBox", `0 0 ${totalWidth} ${height}`); 
    svg.style.display = "block"; 
    
    // Referans Çizgileri
    const drawReferenceLine = (value, color, label) => { 
        const y = paddingTop + (chartHeight - ((value / maxScore) * chartHeight)); 
        
        // Çizgi (SVG içinde - Grafikle beraber uzar/kısalır)
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line"); 
        line.setAttribute("x1", 0); 
        line.setAttribute("y1", y); 
        line.setAttribute("x2", totalWidth); 
        line.setAttribute("y2", y); 
        line.setAttribute("stroke", color); 
        line.setAttribute("stroke-width", "1"); 
        line.setAttribute("stroke-dasharray", "5,5"); 
        line.style.opacity = "0.5"; 
        svg.appendChild(line); 
        
        // Etiket (Overlay içinde - SABİT SOLDA KALIR)
        const tag = document.createElement('div');
        tag.style.position = 'absolute';
        tag.style.left = '5px';
        tag.style.top = (y - 8) + 'px';
        tag.style.color = color;
        tag.style.fontSize = '10px';
        tag.style.fontWeight = 'bold';
        tag.style.textShadow = '0 0 3px var(--card-bg)';
        tag.innerText = `${label}: ${value}`;
        overlay.appendChild(tag);
    }; 
    
    drawReferenceLine(maxScore, "#4caf50", "Rekor"); 
    drawReferenceLine(avgScore, "#ff9800", "Ort"); 
    
    let pathD = "";
    let areaD = ""; // Alan doldurma için yol
    const startX = (currentArchiveFilter === 'all' || currentArchiveFilter === 'season') ? 20 : 30;

    // --- SEZON GÖRÜNÜMÜ İÇİN AY ETİKETLERİ ---
    if (currentArchiveFilter === 'season') {
        let lastMonth = -1;
        const monthNames = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

        data.forEach((item, index) => {
            const parts = item.date.split('.');
            if (parts.length >= 2) {
                const mIndex = parseInt(parts[1]) - 1;
                
                // Ay değiştiyse etiket bas
                if (mIndex !== lastMonth) {
                    const x = startX + (index * pointGap);
                    
                    // Dikey Ay Ayracı
                    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
                    line.setAttribute("x1", x);
                    line.setAttribute("y1", paddingTop);
                    line.setAttribute("x2", x);
                    line.setAttribute("y2", height - paddingBottom);
                    line.setAttribute("stroke", "#333");
                    line.setAttribute("stroke-width", "1");
                    line.setAttribute("stroke-dasharray", "2,4");
                    svg.appendChild(line);

                    // Ay İsmi
                    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
                    text.setAttribute("x", x);
                    text.setAttribute("y", height - 10);
                    text.setAttribute("fill", "#d4af37");
                    text.setAttribute("font-size", "10px");
                    text.setAttribute("font-weight", "bold");
                    text.setAttribute("text-anchor", "middle");
                    text.textContent = monthNames[mIndex];
                    svg.appendChild(text);

                    lastMonth = mIndex;
                }
            }
        });
    }

    // --- TÜMÜ GÖRÜNÜMÜ İÇİN YIL ETİKETLERİ (YENİ) ---
    if (currentArchiveFilter === 'all') {
        let lastYear = -1;
        
        data.forEach((item, index) => {
            const parts = item.date.split('.');
            if (parts.length === 3) {
                const year = parseInt(parts[2]);
                
                // Yıl değiştiyse etiket bas
                if (year !== lastYear) {
                    const x = startX + (index * pointGap);
                    
                    // Dikey Yıl Ayracı
                    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
                    line.setAttribute("x1", x);
                    line.setAttribute("y1", paddingTop);
                    line.setAttribute("x2", x);
                    line.setAttribute("y2", height - paddingBottom);
                    line.setAttribute("stroke", "#555");
                    line.setAttribute("stroke-width", "1");
                    line.setAttribute("stroke-dasharray", "4,4");
                    svg.appendChild(line);

                    // Yıl İsmi
                    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
                    text.setAttribute("x", x);
                    text.setAttribute("y", height - 10);
                    text.setAttribute("fill", "#d4af37");
                    text.setAttribute("font-size", "11px");
                    text.setAttribute("font-weight", "bold");
                    text.setAttribute("text-anchor", "middle");
                    text.textContent = year;
                    svg.appendChild(text);

                    lastYear = year;
                }
            }
        });
    }

    const dotsGroup = document.createElementNS("http://www.w3.org/2000/svg", "g"); 
    
    data.forEach((item, index) => { 
        const x = startX + (index * pointGap); 
        const y = paddingTop + (chartHeight - ((item.score / maxScore) * chartHeight)); 
        
        if (index === 0) {
            pathD += `M ${x} ${y}`;
            areaD += `M ${x} ${height} L ${x} ${y}`; // Başlangıç (alt köşe -> ilk nokta)
        } else {
            pathD += ` L ${x} ${y}`;
            areaD += ` L ${x} ${y}`;
        }
        
        // Son noktada alanı kapat
        if (index === data.length - 1) {
            areaD += ` L ${x} ${height} Z`;
        }
        
        const visibleCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle"); 
        visibleCircle.setAttribute("cx", x); 
        visibleCircle.setAttribute("cy", y); 
        visibleCircle.setAttribute("class", "chart-dot"); 
        visibleCircle.setAttribute("r", dotRadius); 
        visibleCircle.setAttribute("data-orig-r", dotRadius); // Orijinal boyutu sakla
        visibleCircle.setAttribute("fill", "#d4af37"); 
        visibleCircle.setAttribute("stroke", "#000"); 
        visibleCircle.setAttribute("stroke-width", "2"); 
        
        const hitCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle"); 
        hitCircle.setAttribute("cx", x); 
        hitCircle.setAttribute("cy", y); 
        hitCircle.setAttribute("r", 25); // Biraz küçülttük, yanlış tıklamaları önlemek için
        hitCircle.setAttribute("fill", "#fff"); // Transparent yerine opacity 0 daha güvenli
        hitCircle.setAttribute("opacity", "0");
        hitCircle.style.cursor = "pointer"; 
        
        // --- DOKUNUNCA HEMEN AÇILMA (YENİ) ---
        const openDetail = (e) => {
            e.stopPropagation();
            openHistoryDetailModal(item);
        };

        hitCircle.onclick = openDetail;
        // -------------------------------------
        
        dotsGroup.appendChild(visibleCircle); 
        dotsGroup.appendChild(hitCircle); 
    }); 
    
    // Alan (Fill)
    const areaPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    areaPath.setAttribute("d", areaD);
    areaPath.setAttribute("class", "chart-area");
    svg.appendChild(areaPath);

    // Çizgi
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path"); 
    path.setAttribute("d", pathD); 
    path.setAttribute("class", "chart-line"); 
    svg.appendChild(path); 
    svg.appendChild(dotsGroup); 
    
    scrollWrapper.appendChild(svg); 
    
    if (currentArchiveFilter !== 'all' && currentArchiveFilter !== 'season') {
        setTimeout(() => { scrollWrapper.scrollLeft = scrollWrapper.scrollWidth; }, 50); 
    }
}

let currentArchiveType = '18m'; 
let currentArchiveBow = 'all';
let currentArchiveFilter = 'season'; // Zaman filtresi

export function filterArchive(range, btn) {
    currentArchiveFilter = range;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderArchive(null, null);
}

export function renderArchive(type, btnElement) { 
    if (type) currentArchiveType = type; 
    if (btnElement) { 
        document.querySelectorAll('#module-archive .archive-btn').forEach(btn => btn.classList.remove('active')); 
        btnElement.classList.add('active'); 
    } else { 
        const btns = document.querySelectorAll('#module-archive .archive-btn'); 
        if(currentArchiveType === '18m' && btns[0]) btns[0].classList.add('active'); 
        if(currentArchiveType === '70m' && btns[1]) btns[1].classList.add('active'); 
    } 
    
    const key = 'kemankesHistory_' + currentArchiveType; 
    const allHist = JSON.parse(localStorage.getItem(key)) || []; 
    const container = document.getElementById('module-archive'); 
    
    let bowSelector = document.getElementById('archiveBowSelect'); 
    if (!bowSelector) { 
        const controls = container.querySelector('.archive-controls'); 
        const selectContainer = document.createElement('div'); 
        selectContainer.style.marginBottom = "10px"; 
        selectContainer.style.textAlign = "center"; 
        
        bowSelector = document.createElement('select'); 
        bowSelector.id = 'archiveBowSelect'; 
        bowSelector.style.cssText = "background:#333; color:#fff; border:1px solid #555; padding:5px 10px; border-radius:15px; font-size:14px;"; 
        bowSelector.onchange = (e) => { 
            currentArchiveBow = e.target.value; 
            renderArchive(null, null); 
        }; 
        selectContainer.appendChild(bowSelector); 
        controls.parentNode.insertBefore(selectContainer, controls.nextSibling); 
    } 
    
    const bows = [...new Set(allHist.map(item => item.bowName || 'Bilinmeyen Yay'))]; 
    const savedSelection = currentArchiveBow; 
    bowSelector.innerHTML = '<option value="all">Tüm Yaylar</option>'; 
    
    bows.forEach(bow => { 
        const option = document.createElement('option'); 
        option.value = bow; 
        option.innerText = bow; 
        if(bow === savedSelection) option.selected = true; 
        bowSelector.appendChild(option); 
    }); 
    
    let filteredHist = allHist; 
    if (currentArchiveBow !== 'all') { 
        filteredHist = allHist.filter(item => (item.bowName || 'Bilinmeyen Yay') === currentArchiveBow); 
    } 

    // ZAMAN FİLTRESİ UYGULA
    const now = new Date();
    filteredHist = filteredHist.filter(item => {
        if (currentArchiveFilter === 'all') return true;
        
        // Tarih formatı "GG.AA.YYYY" varsayılıyor
        const parts = item.date.split('.');
        const itemDate = new Date(parts[2], parts[1]-1, parts[0]);
        const diffTime = Math.abs(now - itemDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

        if (currentArchiveFilter === '1w') return diffDays <= 7;
        if (currentArchiveFilter === '1m') return diffDays <= 30;
        if (currentArchiveFilter === '6m') return diffDays <= 180;
        if (currentArchiveFilter === 'season') {
            const currentMonth = now.getMonth(); // 0-11 (Eylül = 8)
            const currentYear = now.getFullYear();
            let startYear = currentYear;
            if (currentMonth < 8) startYear = currentYear - 1; // Eğer Eylül'den önceysek (Ocak-Ağustos), sezon geçen sene Eylül'de başladı.
            const seasonStart = new Date(startYear, 8, 1); // 1 Eylül
            return itemDate >= seasonStart;
        }
        return true;
    });
    
    const list = document.getElementById('archiveList'); 
    if(!list) return; 
    list.innerHTML = ''; 
    
    if(filteredHist.length === 0) { 
        list.innerHTML = '<div style="text-align:center; color:#666; margin-top:20px;">Bu kriterde kayıt yok.</div>'; 
        drawChart([]); 
        return; 
    } 
    
    // YILLARA GÖRE GRUPLAMA (ACCORDION)
    const grouped = {};
    filteredHist.forEach(item => {
        const year = item.date.split('.').pop();
        if(!grouped[year]) grouped[year] = [];
        grouped[year].push(item);
    });

    const years = Object.keys(grouped).sort((a,b) => b - a);

    years.forEach(year => {
        // Yılın en yüksek skorunu hesapla
        const maxScore = Math.max(...grouped[year].map(i => i.score));
        
        // Yıl Ortalaması
        let totalScore = 0;
        let totalArrows = 0;
        grouped[year].forEach(i => {
            totalScore += i.score;
            totalArrows += i.arrows;
        });
        const yearAvg = totalArrows > 0 ? (totalScore / totalArrows).toFixed(2) : "0.00";

        const yearGroup = document.createElement('div');
        yearGroup.style.marginBottom = '10px';
        
        const header = document.createElement('div');
        header.style.cssText = "background:#222; padding:10px; border-radius:8px; cursor:pointer; display:flex; justify-content:space-between; align-items:center; border:1px solid #333;";
        header.innerHTML = `<span style="font-weight:bold; color:#d4af37;">📅 ${year} <span style="font-size:11px; color:#aaa; font-weight:normal;">(🏆 ${maxScore} | ⌀ ${yearAvg})</span></span> <span style="font-size:12px; color:#666;">(${grouped[year].length} Kayıt) ▼</span>`;
        
        const contentDiv = document.createElement('div');
        contentDiv.style.display = 'none'; // Varsayılan kapalı
        contentDiv.style.marginTop = '5px';
        contentDiv.style.paddingLeft = '5px';

        header.onclick = () => {
            const isOpen = contentDiv.style.display === 'block';
            contentDiv.style.display = isOpen ? 'none' : 'block';
            header.querySelector('span:last-child').innerText = `(${grouped[year].length} Kayıt) ${isOpen ? '▼' : '▲'}`;
        };

        grouped[year].forEach(item => {
            const realIdx = allHist.indexOf(item); 
            const div = document.createElement('div'); 
            div.className = 'history-item'; 
            const bowLabel = item.bowName ? `<span style="font-size:10px; color:#aaa; margin-left:5px;">(${item.bowName})</span>` : ''; 
            
            div.innerHTML = `
                <div>
                    <span style="color:#d4af37; font-weight:bold;">${item.score} Puan</span> ${bowLabel}<br>
                    <span style="font-size:11px; color:#888;">${item.date} ${item.time}</span>
                </div> 
                <button class="btn-delete-record" onclick="window.deleteHistoryItem('${currentArchiveType}', ${realIdx})">Sil</button>`; 
            contentDiv.appendChild(div);
        });

        yearGroup.appendChild(header);
        yearGroup.appendChild(contentDiv);
        list.appendChild(yearGroup);
    });

    // İlk yılı otomatik aç
    if(list.firstChild && list.firstChild.lastChild) {
        list.firstChild.lastChild.style.display = 'block';
        list.firstChild.firstChild.querySelector('span:last-child').innerText = list.firstChild.firstChild.querySelector('span:last-child').innerText.replace('▼', '▲');
    }
    
    drawChart([...filteredHist].reverse()); 
}

// =======================================================
// 3. ANALİZ & SİMÜLASYON UI
// =======================================================

let currentAnalysisType = '18m';
let simulationSelected = []; 

export function renderArrowAnalysis(type, btnElement, sortMode = 'accuracy') {
    if (type) currentAnalysisType = type; else type = currentAnalysisType;
    if (btnElement) { 
        document.querySelectorAll('#module-analysis .archive-btn').forEach(b => b.classList.remove('active')); 
        btnElement.classList.add('active'); 
    }

    let simBar = document.getElementById('simulationBar');
    if(simBar) simBar.style.display = 'none';

    const container = document.getElementById('analysisContent');
    if(!container) return; 
    container.innerHTML = '';

    // Yay Seçimi
    const controlsDiv = document.createElement('div'); 
    controlsDiv.style.marginBottom = '10px';
    
    const selector = document.createElement('select'); 
    selector.id = 'analysisBowSelector'; 
    selector.style.cssText = "background:#333; color:#fff; border:1px solid #555; padding:5px; border-radius:4px; margin-top:5px; width:100%;";
    
    const allSettings = JSON.parse(localStorage.getItem('kemankesBowSettings')) || {}; 
    const moduleSettings = allSettings[type] || [{},{},{}];
    
    moduleSettings.forEach((slot, idx) => { 
        const opt = document.createElement('option'); 
        opt.value = idx; 
        opt.text = slot.name || `Yay ${idx+1}`; 
        if(idx === state.currentBowSlot) opt.selected = true; 
        selector.appendChild(opt); 
    });
    
    selector.onchange = (e) => { 
        state.currentBowSlot = parseInt(e.target.value); 
        renderArrowAnalysis(currentAnalysisType); 
    }; 
    controlsDiv.appendChild(selector); 
    container.appendChild(controlsDiv);

    // "DETAY / YÖNETİM" BUTONU
    const btnDetail = document.createElement('button');
    btnDetail.className = 'btn-add-note'; 
    btnDetail.style.width = '100%';
    btnDetail.style.marginBottom = '15px';
    btnDetail.style.backgroundColor = '#333'; 
    btnDetail.style.border = '1px solid #d4af37'; 
    btnDetail.style.color = '#d4af37'; 
    btnDetail.innerText = '⚙️ Detaylı Yönetim & Simülasyon';
    btnDetail.onclick = renderArrowDetails;
    container.appendChild(btnDetail);

    // İstatistik Verisi
    const globalStatsKey = `kemankesGlobalStats_${type}_${state.currentBowSlot}`;
    const stats = JSON.parse(localStorage.getItem(globalStatsKey)) || {};
    const bannedKey = `kemankesBanned_${type}_${state.currentBowSlot}`;
    const bannedList = JSON.parse(localStorage.getItem(bannedKey)) || [];

    if (Object.keys(stats).length === 0) { 
        const emptyDiv = document.createElement('div');
        emptyDiv.style.cssText = "text-align:center; color:#666; margin-top:20px; font-style:italic;";
        emptyDiv.innerText = "Bu yay için veri yok.";
        container.appendChild(emptyDiv);
        return; 
    }

    let activeArrows = [];
    Object.keys(stats).forEach(key => {
        if (!bannedList.includes(key)) {
            const s = stats[key];
            if (s.shots > 0) {
                let pct = type === '18m' ? ((s.headShots || 0) / s.shots) * 100 : (s.hits / s.shots) * 100;
                let avg = s.totalScore / s.shots;
                activeArrows.push({ label: key, hits: s.hits, shots: s.shots, pct: pct, avg: avg, totalScore: s.totalScore, headShots: s.headShots || 0, sessions: s.sessions || 0 });
            }
        }
    });

    // Sıralama
    activeArrows.sort((a, b) => {
        if(sortMode === 'accuracy') { return b.pct - a.pct; } 
        else { return parseInt(a.label.replace(/^\D+/g, '')) - parseInt(b.label.replace(/^\D+/g, '')); }
    });

    const createSimpleCard = (title, items, color) => {
        if (items.length === 0) return null;
        
        const card = document.createElement('div');
        card.className = 'analysis-card';
        card.style.borderColor = color;
        card.style.display = 'flex';
        card.style.flexDirection = 'column';
        
        const titleDiv = document.createElement('div');
        titleDiv.style.cssText = `color:${color}; font-size:14px; font-weight:bold; text-align:center; margin-bottom:10px;`;
        titleDiv.innerText = title;
        card.appendChild(titleDiv);

        const table = document.createElement('table');
        table.style.cssText = "width:100%; font-size:13px; color:var(--text-color); border-collapse:collapse; text-align:center;";
        
        const thead = document.createElement('thead');
        thead.innerHTML = `<tr style="color:#888; font-size:11px; border-bottom:1px solid #444;">
            <th style="padding:5px;">OK</th><th>KAFA</th><th>HIT</th><th>MISS</th><th>%</th><th>MAÇ</th>
        </tr>`;
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        items.forEach(item => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid #333';
            const hs = type === '18m' ? item.headShots : '-';
            const misses = item.shots - item.hits;
            tr.innerHTML = `
                <td style="padding:8px 0; font-weight:bold;">${item.label}</td>
                <td>${hs}</td>
                <td>${item.hits}</td>
                <td>${misses}</td>
                <td style="color:${item.pct > 75 ? '#4caf50' : 'var(--text-color)'}">%${Math.round(item.pct)}</td>
                <td>${item.sessions}</td>
            `;
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        card.appendChild(table);
        
        return card;
    };

    const card1 = createSimpleCard("AS KADRO (İLK 12 - EN BAŞARILI)", activeArrows.slice(0, 12), "#4caf50");
    if(card1) container.appendChild(card1);
    
    const card2 = createSimpleCard("YEDEKLER", activeArrows.slice(12, 20), "#ff9800");
    if(card2) container.appendChild(card2);
}

export function renderArrowDetails() {
    const container = document.getElementById('analysisContent');
    if(!container) return; 
    container.innerHTML = '';

    // SİMÜLASYON BARINI ZORLA EKLE VE STİL VER
    let simBar = document.getElementById('simulationBar');
    if(!simBar) {
        simBar = document.createElement('div');
        simBar.id = 'simulationBar';
        simBar.style.cssText = "position:fixed; bottom:0; left:0; width:100%; background:#111; border-top:2px solid #d4af37; padding:15px; display:none; justify-content:space-between; align-items:center; box-shadow:0 -5px 20px rgba(0,0,0,0.9); z-index:9999; box-sizing:border-box;";
        simBar.innerHTML = `<span style="font-size:14px; color:#fff;">Seçili: <span id="simCount" style="color:#d4af37; font-weight:bold;">0</span></span> <span style="font-size:18px; color:#fff;">Ort: <span id="simAvg" style="color:#d4af37; font-weight:bold;">0.0</span></span>`;
        document.body.appendChild(simBar);
    }
    simulationSelected = []; 
    simBar.style.display = 'none';

    // GERİ BUTONU
    const headerDiv = document.createElement('div');
    const backBtn = document.createElement('button');
    backBtn.className = 'btn-add-note';
    backBtn.innerText = '⬅️ Basit Görünüme Dön';
    backBtn.style.cssText = "width:100%; margin-bottom:15px; background-color:#333; border:1px solid #666;";
    backBtn.onclick = () => renderArrowAnalysis(currentAnalysisType);
    headerDiv.appendChild(backBtn);
    
    const title = document.createElement('div');
    title.style.cssText = "text-align:center; color:#d4af37; margin-bottom:10px; font-weight:bold;";
    title.innerText = "TAKIM SİMÜLASYONU & KARANTİNA";
    headerDiv.appendChild(title);
    
    const desc = document.createElement('p');
    desc.style.cssText = "text-align:center; font-size:11px; color:#888;";
    desc.innerText = "Okları seçerek takım ortalamasını gör. 🎯 ikonuna basarak vuruş dağılımına bak. 🚫 ile oku karantinaya al.";
    headerDiv.appendChild(desc);

    // --- AS KADRO BUTONU (YENİ) ---
    const config = moduleConfigs[currentAnalysisType];
    const limit = config ? config.arrowsPerRound : 12;

    const btnAutoSelect = document.createElement('button');
    btnAutoSelect.className = 'btn-stats';
    btnAutoSelect.style.width = '100%';
    btnAutoSelect.style.marginBottom = '15px';
    btnAutoSelect.style.backgroundColor = '#4caf50';
    btnAutoSelect.style.color = '#fff';
    btnAutoSelect.innerText = `✨ As Kadroyu Seç (En İyi ${limit})`;
    btnAutoSelect.onclick = selectBestSquad;
    headerDiv.appendChild(btnAutoSelect);
    // ------------------------------
    
    container.appendChild(headerDiv);

    // DATA ÇEKME
    const globalStatsKey = `kemankesGlobalStats_${currentAnalysisType}_${state.currentBowSlot}`;
    const stats = JSON.parse(localStorage.getItem(globalStatsKey)) || {};
    const bannedKey = `kemankesBanned_${currentAnalysisType}_${state.currentBowSlot}`;
    const bannedList = JSON.parse(localStorage.getItem(bannedKey)) || [];
    const reasonsKey = `kemankesBannedReasons_${currentAnalysisType}_${state.currentBowSlot}`;
    const bannedReasons = JSON.parse(localStorage.getItem(reasonsKey)) || {};

    let activeArrows = []; 
    let bannedArrows = [];
    
    Object.keys(stats).forEach(key => {
        const s = stats[key];
        if (s.shots > 0) {
            let avg = s.totalScore / s.shots;
            avg = Number(avg) || 0;
            let item = { label: key, avg: avg, headShots: s.headShots || 0, hits: s.hits, shots: s.shots };
            if (bannedList.includes(key)) {
                item.reason = bannedReasons[key];
                bannedArrows.push(item); 
            } else activeArrows.push(item);
        }
    });
    
    // 70m Modunda Temizlik: Eğer listede "B" serisi oklar varsa, sadece sayıdan oluşan (1-9) eski/hatalı kayıtları gizle
    if (currentAnalysisType === '70m') {
        const hasBSeries = activeArrows.some(item => item.label.startsWith('B'));
        if (hasBSeries) {
            activeArrows = activeArrows.filter(item => !/^\d+$/.test(item.label));
        }
    }

    activeArrows.sort((a, b) => b.avg - a.avg);

    const createManagementList = (items, color, isBanned) => {
        if (items.length === 0) return null;
        
        const card = document.createElement('div');
        card.className = 'analysis-card';
        if(isBanned) {
            card.style.border = '1px dashed #555';
            card.style.background = 'rgba(255,0,0,0.05)';
            card.innerHTML = `<div style="color:#f44336; text-align:center; font-weight:bold; margin-bottom:5px;">KARANTİNA (YARIŞMA DIŞI)</div>`;
        } else {
            card.style.borderColor = color;
        }
        
        const table = document.createElement('table');
        table.style.cssText = "width:100%; border-collapse:collapse; font-size:13px; color:var(--text-color); table-layout:fixed;";

        const thead = document.createElement('thead');
        thead.innerHTML = `
            <tr style="color:#888; font-size:11px; border-bottom:1px solid #444;">
                <th style="width:15%; text-align:center; padding:5px;">${isBanned ? '' : 'SEÇ'}</th>
                <th style="width:25%; text-align:left; padding:5px;">OK</th>
                <th style="width:25%; text-align:center; padding:5px;">ORT</th>
                <th style="width:35%; text-align:right; padding:5px;">İŞLEM</th>
            </tr>
        `;
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        items.forEach(item => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid #333';
            tr.style.height = '45px';

            const tdCheck = document.createElement('td');
            tdCheck.style.cssText = "text-align:center; vertical-align:middle;";
            if (!isBanned) {
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.className = 'sim-checkbox';
                checkbox.dataset.label = item.label;
                checkbox.dataset.avg = item.avg;
                checkbox.style.cssText = "transform:scale(1.3); accent-color:#d4af37; cursor:pointer;";
                checkbox.onchange = function() { updateSimulation(this, item.label, item.avg); };
                tr.onclick = (e) => {
                    if (e.target !== checkbox && e.target.tagName !== 'BUTTON') {
                        checkbox.checked = !checkbox.checked;
                        updateSimulation(checkbox, item.label, item.avg);
                    }
                };
                tdCheck.appendChild(checkbox);
            } else {
                tdCheck.innerHTML = '<span style="color:#f44336; font-size:10px;">YASAK</span>';
            }
            tr.appendChild(tdCheck);

            const tdLabel = document.createElement('td');
            tdLabel.style.cssText = "text-align:left; vertical-align:middle; font-weight:bold; padding-left:5px;";
            tdLabel.innerText = item.label;
            if (item.reason) {
                tdLabel.innerHTML += `<div style="font-size:10px; color:#f44336; font-weight:normal; font-style:italic;">${item.reason}</div>`;
            }
            tr.appendChild(tdLabel);

            const tdAvg = document.createElement('td');
            tdAvg.style.cssText = "text-align:center; vertical-align:middle; color:#aaa;";
            tdAvg.innerText = item.avg.toFixed(2);
            tr.appendChild(tdAvg);

            const tdActions = document.createElement('td');
            tdActions.style.cssText = "text-align:right; vertical-align:middle;";
            const divActions = document.createElement('div');
            divActions.style.cssText = "display:flex; justify-content:flex-end; gap:8px;";

            const btnTarget = document.createElement('button');
            btnTarget.className = 'btn-icon';
            btnTarget.innerHTML = '🎯';
            btnTarget.style.padding = '5px 8px';
            btnTarget.onclick = (e) => { e.stopPropagation(); showArrowHeatmap(item.label); };
            
            const btnBan = document.createElement('button');
            btnBan.className = 'btn-icon';
            btnBan.innerHTML = isBanned ? '♻️' : '🚫';
            btnBan.style.color = isBanned ? '#4caf50' : '#f44336';
            btnBan.style.padding = '5px 8px';
            btnBan.onclick = (e) => { e.stopPropagation(); window.toggleArrowBan(item.label, !isBanned, currentAnalysisType); };
            
            divActions.appendChild(btnTarget);
            
            // Karantinadaki Oklar İçin Sıfırlama Özelliği
            if (isBanned) {
                const btnReset = document.createElement('button');
                btnReset.className = 'btn-icon';
                btnReset.innerHTML = '🗑️';
                btnReset.title = 'Verileri Sıfırla';
                btnReset.style.color = '#888';
                btnReset.style.padding = '5px 8px';
                btnReset.onclick = (e) => { e.stopPropagation(); window.resetArrowStats(item.label, currentAnalysisType); };
                divActions.appendChild(btnReset);
            }
            
            divActions.appendChild(btnBan);
            tdActions.appendChild(divActions);
            tr.appendChild(tdActions);
            tbody.appendChild(tr);
        });
        
        table.appendChild(tbody);
        card.appendChild(table);
        
        return card;
    };
    
    const listActive = createManagementList(activeArrows, "#2196f3", false);
    if(listActive) container.appendChild(listActive);
    
    const listBanned = createManagementList(bannedArrows, "#f44336", true);
    if(listBanned) container.appendChild(listBanned);
}

// --- AS KADRO SEÇİCİ (YENİ) ---
export function selectBestSquad() {
    const config = moduleConfigs[currentAnalysisType];
    const limit = config ? config.arrowsPerRound : 12;

    const checkboxes = document.querySelectorAll('.sim-checkbox');
    // Checkboxları sıfırla
    checkboxes.forEach(cb => {
        if(cb.checked) {
            cb.checked = false;
            updateSimulation(cb, cb.dataset.label, cb.dataset.avg);
        }
    });

    // İlk limit tanesini seç (Zaten renderArrowDetails içinde sıralı geliyor)
    let count = 0;
    checkboxes.forEach(cb => {
        if(count < limit) {
            cb.checked = true;
            updateSimulation(cb, cb.dataset.label, cb.dataset.avg);
            count++;
        }
    });
}
// ------------------------------

export function updateSimulation(checkbox, label, avg) {
    const score = Number(avg);
    
    if (checkbox.checked) {
        if (!simulationSelected.some(item => item.label === label)) {
            simulationSelected.push({ label: label, score: score });
        }
    } else {
        simulationSelected = simulationSelected.filter(item => item.label !== label);
    }

    const bar = document.getElementById('simulationBar');
    const countEl = document.getElementById('simCount');
    const avgEl = document.getElementById('simAvg');

    if (simulationSelected.length > 0) {
        const total = simulationSelected.reduce((sum, item) => sum + item.score, 0);
        const teamAvg = total / simulationSelected.length;
        
        countEl.innerText = simulationSelected.length;
        avgEl.innerText = teamAvg.toFixed(2);
        
        if(teamAvg > 2.8) avgEl.style.color = '#4caf50'; 
        else if(teamAvg > 2.5) avgEl.style.color = '#ff9800'; 
        else avgEl.style.color = '#f44336'; 

        bar.style.display = 'flex';
    } else {
        bar.style.display = 'none';
    }
}

export function showArrowHeatmap(label) {
    let modal = document.getElementById('heatmapModal');
    if (!modal) { 
        modal = document.createElement('div'); 
        modal.id = 'heatmapModal'; 
        modal.className = 'image-modal'; 
        modal.onclick = (e) => { if(e.target === modal) modal.style.display = 'none'; }; 
        document.body.appendChild(modal); 
    }
    
    const history = JSON.parse(localStorage.getItem('kemankesTargetHistory')) || [];
    const targetConfig = targetConfigs[currentAnalysisType] || targetConfigs['18m'];
    let count = 0;
    
    // --- SAPMA ANALİZİ (YENİ) ---
    let sumX = 0;
    let sumY = 0;
    // ----------------------------

    modal.innerHTML = `<div class="modal-content" style="background:#222; text-align:center; max-width:95%;">
        <h3 style="color:#d4af37; margin-top:0;">${label} - Vuruş Dağılımı</h3>
        <div style="position:relative; display:inline-block;">
            <svg id="heatmapSvg" viewBox="0 0 300 300" style="width:300px; height:300px; background:url('${targetConfig.image}') no-repeat center/contain; border-radius:50%; box-shadow:0 0 20px rgba(0,0,0,0.5);"></svg>
        </div>
        <p style="font-size:12px; color:#aaa;" id="heatmapInfo">Hesaplanıyor...</p>
        <div id="deviationInfo" style="margin-top:5px; font-size:13px; font-weight:bold; color:#fff; border-top:1px solid #444; padding-top:5px;"></div>
        <button onclick="document.getElementById('heatmapModal').style.display='none'" style="margin-top:10px; padding:10px 30px; background:#333; color:#fff; border:none; border-radius:20px;">Kapat</button>
    </div>`;
    
    const svgEl = modal.querySelector('#heatmapSvg');
    
    // SVG ViewBox 300x300 olduğu için merkez 150,150'dir.
    // Ancak Target modülü 400x400 kaydediyor. Oranlamamız lazım.
    const scaleFactor = 300 / 400;

    history.forEach(session => { 
        if (session.face === currentAnalysisType && session.rounds) { 
            session.rounds.forEach(round => { 
                round.forEach(shot => { 
                    if (shot.label === label) { 
                        // Koordinatları 300x300'e uyarla
                        const cx = shot.x * scaleFactor;
                        const cy = shot.y * scaleFactor;

                        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle"); 
                        circle.setAttribute("cx", cx); 
                        circle.setAttribute("cy", cy); 
                        circle.setAttribute("r", "5"); 
                        circle.setAttribute("fill", "red"); 
                        circle.setAttribute("stroke", "white"); 
                        circle.setAttribute("stroke-width", "1"); 
                        circle.setAttribute("opacity", "0.8"); 
                        svgEl.appendChild(circle); 
                        
                        sumX += shot.x; // Orijinal koordinatları topla (400x400 üzerinden)
                        sumY += shot.y;
                        count++; 
                    } 
                }); 
            }); 
        } 
    });
    
    document.getElementById('heatmapInfo').innerText = count > 0 ? `Toplam ${count} atış kaydedildi.` : "Bu ok için hedef kaydı (Target Modülü) bulunamadı."; 
    
    // --- SAPMA ANALİZİ SONUCU ---
    if (count > 0) {
        const avgX = sumX / count;
        const avgY = sumY / count;
        const centerX = 200; // 400x400'ün merkezi
        const centerY = 200;
        
        const diffX = avgX - centerX;
        const diffY = avgY - centerY;
        
        let devText = "";
        const threshold = 15; // Hassasiyet

        if (diffX < -threshold) devText += "⬅️ Sola ";
        else if (diffX > threshold) devText += "➡️ Sağa ";
        
        if (diffY < -threshold) devText += "⬆️ Yukarı ";
        else if (diffY > threshold) devText += "⬇️ Aşağı ";
        
        if (devText === "") devText = "🎯 Merkezde Toplanıyor";
        else devText += "Çekiyor";

        document.getElementById('deviationInfo').innerText = devText;
        document.getElementById('deviationInfo').style.color = devText.includes("Merkez") ? "#4caf50" : "#ff9800";
    }
    // ----------------------------

    modal.style.display = 'flex';
}

export function showMatchStats() { 
    const session = state.sessions[state.activeModuleId]; 
    const stats = session.arrowStats; 
    const content = document.getElementById('statsContent'); 
    
    if (Object.keys(stats).length === 0) { 
        content.innerHTML = "<p>Henüz veri yok.</p>"; 
    } else { 
        let html = ''; 
        if (state.activeModuleId === '18m') { 
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

// =======================================================
// 4. NOTLAR & MODALLAR
// =======================================================

export function toggleNoteForm(show) { 
    document.getElementById('addNoteForm').style.display = show ? 'block' : 'none'; 
    document.getElementById('showFormBtn').style.display = show ? 'none' : 'block'; 
    if (!show) { 
        document.getElementById('noteTitle').value = ''; 
        document.getElementById('noteEditor').innerHTML = ''; 
    } 
}

export function renderNotes() { 
    const list = document.getElementById('notesList'); 
    const notes = JSON.parse(localStorage.getItem('kemankesNotes')) || []; 
    list.innerHTML = ''; 
    
    if (notes.length === 0) { 
        list.innerHTML = '<div style="text-align:center; color:#666;">Henüz not yok.</div>'; 
        return; 
    } 
    
    notes.forEach((note, index) => { 
        const card = document.createElement('div'); 
        card.className = 'note-card'; 
        card.setAttribute('draggable', 'true'); 
        card.dataset.index = index; 
        
        const tempDiv = document.createElement('div'); 
        tempDiv.innerHTML = note.text || ''; 
        let plainText = tempDiv.textContent || tempDiv.innerText || ''; 
        
        if (!plainText.trim() && (note.text.includes('<img') || note.image)) plainText = "📷 [Resim]"; 
        else if (!plainText.trim()) plainText = "İçerik yok..."; 
        
        card.innerHTML = `
            <div class="note-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <span class="drag-handle" style="cursor:grab; font-size:20px; color:#666; padding:0 10px;">☰</span>
                    <span>${note.date}</span>
                </div>
                <div>
                    <button onclick="event.stopPropagation(); window.editNote(${index})" style="background:none; border:none; color:#d4af37; font-size:16px; margin-right:10px;">✏️</button>
                    <button onclick="event.stopPropagation(); window.deleteNote(${index})" style="background:none; border:none; color:#8b0000; font-size:16px;">🗑️</button>
                </div>
            </div>
            <div style="font-weight:bold; color:#d4af37; font-size:16px; margin-bottom:5px;">${note.title || 'Başlıksız'}</div>
            <div class="note-preview-text">${plainText}</div>`; 
            
        card.onclick = (e) => { 
            if(e.target.classList.contains('drag-handle')) return; 
            openNoteDetail(index); 
        }; 
        
        card.addEventListener('dragstart', window.handleDragStartDesktop); 
        card.addEventListener('dragover', window.handleDragOverDesktop); 
        card.addEventListener('drop', window.handleDropDesktop); 
        card.addEventListener('dragend', window.handleDragEndDesktop); 
        
        const handle = card.querySelector('.drag-handle'); 
        handle.addEventListener('touchstart', window.handleTouchStartMobile, {passive: false}); 
        handle.addEventListener('touchmove', window.handleTouchMoveMobile, {passive: false}); 
        handle.addEventListener('touchend', window.handleTouchEndMobile); 
        
        list.appendChild(card); 
    }); 
}

export function openNoteDetail(index) { 
    const notes = JSON.parse(localStorage.getItem('kemankesNotes')) || []; 
    const note = notes[index]; 
    if (!note) return; 
    
    document.getElementById('noteDetailDate').innerText = note.date; 
    document.getElementById('noteDetailTitle').innerText = note.title || 'Başlıksız Not'; 
    
    let content = note.text || ''; 
    if (content && !content.includes('<') && content.includes('\n')) content = content.replace(/\n/g, '<br>'); 
    if (note.image) content += `<br><img src="${note.image}" style="max-width:100%; margin-top:10px;">`; 
    
    const body = document.getElementById('noteDetailBody'); 
    body.innerHTML = content; 
    body.style.border = "1px solid #444"; 
    body.style.padding = "10px"; 
    body.style.borderRadius = "8px"; 
    body.style.backgroundColor = "rgba(255,255,255,0.02)"; 
    
    body.querySelectorAll('img').forEach(img => { 
        img.onclick = () => window.openImageModal(img.src); 
        img.style.cursor = 'pointer'; 
    }); 
    
    document.getElementById('noteDetailEditBtn').onclick = () => { 
        document.getElementById('noteDetailModal').style.display = 'none'; 
        window.editNote(index); 
    }; 
    document.getElementById('noteDetailModal').style.display = 'flex'; 
}

export function openImageModal(src) { 
    document.getElementById('fullImage').src = src; 
    document.getElementById('imageModal').style.display = 'flex'; 
}

export function openBowSettings() { 
    document.getElementById('bowSettingsModal').style.display = 'flex'; 
    window.switchBowSlot(0); 
}

// --- FOC HESAPLAYICI (YENİ) ---
export function calculateFOC() {
    const length = parseFloat(document.getElementById('focLength').value);
    const balance = parseFloat(document.getElementById('focBalance').value);
    const resultEl = document.getElementById('focResult');

    if (!length || !balance) {
        resultEl.innerText = "Değer girin!";
        resultEl.style.color = "red";
        return;
    }

    // Formül: FOC (%) = [(Denge Noktası - (Ok Uzunluğu / 2)) / Ok Uzunluğu] * 100
    const foc = ((balance - (length / 2)) / length) * 100;
    const focVal = foc.toFixed(1);

    let status = "";
    let color = "#fff";

    if (foc < 10) { status = "(Hafif Kafa)"; color = "#ff9800"; }
    else if (foc > 16) { status = "(Ağır Kafa)"; color = "#ff9800"; }
    else { status = "(Normal)"; color = "#4caf50"; }

    resultEl.innerHTML = `FOC: <b>%${focVal}</b> <span style="font-size:10px;">${status}</span>`;
    resultEl.style.color = color;
}
// ------------------------------

// =======================================================
// 5. HEDEF (TARGET) UI
// =======================================================

export function renderTargetMarks() { 
    const svgGroup = document.getElementById('targetMarks'); 
    if (!svgGroup) return; 
    svgGroup.innerHTML = ''; 
    
    const currentFaceData = state.targetSessionData[state.currentTargetFace]; 
    const pointsToRender = currentFaceData[state.currentTargetRound - 1]; 
    
    if (pointsToRender && Array.isArray(pointsToRender)) { 
        pointsToRender.forEach((pt, index) => { 
            const g = document.createElementNS("http://www.w3.org/2000/svg", "g"); 
            g.setAttribute("transform", `translate(${pt.x}, ${pt.y})`); 
            g.setAttribute("onclick", `window.editTargetMark(${index}, event)`); 
            g.style.cursor = "pointer"; 
            
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
            text.style.textShadow = "1px 1px 2px #000"; 
            text.textContent = pt.label; 
            g.appendChild(text); 
            
            svgGroup.appendChild(g); 
        }); 
    } 
}

export function loadTargetHistoryUI() { 
    const list = document.getElementById('targetHistoryList'); 
    if (!list) return; 
    
    const history = JSON.parse(localStorage.getItem('kemankesTargetHistory')) || []; 
    list.innerHTML = ''; 
    
    if (history.length === 0) {
        list.innerHTML = '<div style="text-align:center; color:#666;">Henüz kayıt yok.</div>';
        return;
    }

    const grouped = {};
    history.forEach((item, index) => {
        let year = "Tarihsiz";
        if (item.date) {
            const parts = item.date.split('.');
            if (parts.length === 3) year = parts[2];
        }
        if (!grouped[year]) grouped[year] = [];
        grouped[year].push({ ...item, originalIndex: index });
    });

    const years = Object.keys(grouped).sort((a, b) => b - a);

    years.forEach(year => {
        const yearGroup = document.createElement('div');
        yearGroup.style.marginBottom = '10px';
        
        const header = document.createElement('div');
        header.style.cssText = "background:#222; padding:10px; border-radius:8px; cursor:pointer; display:flex; justify-content:space-between; align-items:center; border:1px solid #333; margin-bottom:5px;";
        header.innerHTML = `<span style="font-weight:bold; color:#d4af37;">📅 ${year}</span> <span style="font-size:12px; color:#666;">(${grouped[year].length} Kayıt) ▼</span>`;
        
        const contentDiv = document.createElement('div');
        contentDiv.style.display = 'none'; 
        contentDiv.style.paddingLeft = '5px';

        header.onclick = () => {
            const isOpen = contentDiv.style.display === 'block';
            contentDiv.style.display = isOpen ? 'none' : 'block';
            header.querySelector('span:last-child').innerText = `(${grouped[year].length} Kayıt) ${isOpen ? '▼' : '▲'}`;
        };

        grouped[year].forEach(item => {
            const div = document.createElement('div'); 
            div.className = 'history-item'; 
            const arrowCount = item.rounds ? item.rounds.reduce((acc, r) => acc + r.length, 0) : 0; 
            
            div.innerHTML = `
                <div onclick="window.loadTargetAnalysisFromHistory(${item.originalIndex})" style="cursor:pointer; flex-grow:1;">
                    <div style="color:#d4af37">${item.date} ${item.time}</div>
                    <div style="font-size:12px; color:#888;">${item.face} - ${arrowCount} ok</div>
                </div>
                <button class="btn-delete-record" onclick="window.deleteTargetHistory(${item.originalIndex})">Sil</button>`; 
            contentDiv.appendChild(div); 
        });

        yearGroup.appendChild(header);
        yearGroup.appendChild(contentDiv);
        list.appendChild(yearGroup);
    }); 

    if(list.firstChild && list.firstChild.lastChild) {
        list.firstChild.lastChild.style.display = 'block';
        list.firstChild.firstChild.querySelector('span:last-child').innerText = list.firstChild.firstChild.querySelector('span:last-child').innerText.replace('▼', '▲');
    }
}

export function injectTargetResetButton() {
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
        btn.onclick = window.resetTargetSession;
        undoBtn.parentNode.insertBefore(btn, undoBtn.nextSibling);
    }
}

// =======================================================
// 6. ANTRENÖR MODÜLÜ UI
// =======================================================

export function renderDrills() {
    const container = document.getElementById('coachContent');
    if(!container) return;
    
    document.querySelectorAll('#module-coach .archive-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('#module-coach .archive-btn')[0].classList.add('active');

    // KRONOMETRE / SAYAÇ HTML
    const timerHTML = `
    <div style="background:rgba(0,0,0,0.3); padding:10px; border-radius:10px; border:1px solid #444; margin-bottom:15px; display:flex; flex-direction:column; align-items:center;">
        <div id="timerDisplay" style="font-size:32px; font-weight:bold; color:#d4af37; font-family:monospace; margin-bottom:5px; text-shadow: 0 0 10px rgba(212, 175, 55, 0.3);">00:00</div>
        <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap; justify-content:center;">
            <input type="number" id="timerInput" placeholder="Sn" style="width:60px; padding:8px; border-radius:5px; border:1px solid #555; background:#222; color:#fff; text-align:center; font-size:14px;">
            <button onclick="window.startTimer()" style="background:#4caf50; color:white; border:none; padding:8px 15px; border-radius:5px; cursor:pointer; font-weight:bold;">Başlat</button>
            <button onclick="window.stopTimer()" style="background:#f44336; color:white; border:none; padding:8px 15px; border-radius:5px; cursor:pointer; font-weight:bold;">Durdur</button>
            <button onclick="window.resetTimer()" style="background:#333; color:white; border:none; padding:8px 15px; border-radius:5px; cursor:pointer; font-weight:bold;">Sıfırla</button>
        </div>
        <div style="font-size:11px; color:#aaa; margin-top:5px; text-align:center;">(Süre girerseniz geri sayar, boş bırakırsanız kronometre çalışır)</div>
    </div>`;

    // Kayıtlı Drill Listesini Çek (Yoksa varsayılanları yükle)
    let drills = JSON.parse(localStorage.getItem('kemankesDrills'));
    if (!drills || drills.length === 0) {
        drills = ["Gözler kapalı atış (3 ok)", "3 saniye tam çekişte bekle ve at", "Nefes tutarak atış (Yarım nefes)", "Çok yavaş çekiş (10 saniye)", "Clicker düşmeden bırak (Kontrollü)", "Sadece bırakışa odaklan (Hedefi unut)", "Sırt tansiyonunu hisset", "Yay kolunu itmeye odaklan"];
        localStorage.setItem('kemankesDrills', JSON.stringify(drills));
    }

    container.innerHTML = `
        ${timerHTML}
        <div style="text-align:center; margin-top:20px;">
            <div id="drillDisplay" style="font-size:24px; color:#d4af37; font-weight:bold; min-height:80px; display:flex; align-items:center; justify-content:center; border:2px dashed #444; border-radius:15px; padding:20px; margin-bottom:20px;">
                🎲 Hazır mısın?
            </div>
            <button class="btn-add-note" onclick="window.pickRandomDrill()">YENİ GÖREV ÇEK</button>
        </div>

        <div style="margin-top:30px; border-top:1px solid #333; padding-top:15px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; cursor:pointer; user-select:none;" 
                 onclick="const el = document.getElementById('drillListContainer'); const icon = this.querySelector('#drillToggleIcon'); if(el.style.display === 'none') { el.style.display = 'block'; icon.innerText = '▲'; } else { el.style.display = 'none'; icon.innerText = '▼'; }">
                <h3 style="margin:0; font-size:16px; color:#aaa;">
                    Görev Havuzu (${drills.length}) 
                    <span id="drillToggleIcon" style="font-size:12px; margin-left:5px;">▼</span>
                </h3>
                <button onclick="event.stopPropagation(); window.openDrillModal()" style="background:#333; color:#d4af37; border:1px solid #d4af37; padding:5px 10px; border-radius:5px; font-size:12px;">+ Yeni Ekle</button>
            </div>
            <div id="drillListContainer" class="notes-list" style="display:none; max-height:300px; overflow-y:auto;">
                ${drills.map((drill, index) => `
                    <div class="note-card" style="padding:10px; display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size:13px;">${drill}</span>
                        <button onclick="window.deleteDrill(${index})" style="background:none; border:none; color:#8b0000; font-size:16px;">🗑️</button>
                    </div>
                `).join('')}
            </div>
        </div>

        <!-- Drill Ekleme Modalı -->
        <div id="drillModal" class="image-modal" onclick="if(event.target===this) this.style.display='none'">
            <div class="modal-content" style="background:var(--card-bg); padding:20px; width:90%; max-width:350px; color:var(--text-color); border: 1px solid #d4af37;">
                <span class="close-modal" onclick="document.getElementById('drillModal').style.display='none'">&times;</span>
                <h2 style="color:#d4af37; margin-top:0;">Yeni Görev Ekle</h2>
                <input type="text" id="newDrillInput" class="arrow-group-input" placeholder="Örn: Tek ayak üzerinde atış..." style="margin-bottom:15px; width:100%;">
                <button class="btn-add-note" onclick="window.saveDrill()">Listeye Ekle</button>
            </div>
        </div>
    `;
    
    // Eğer sayaç çalışıyorsa UI'ı güncelle
    if(window.updateTimerUI) window.updateTimerUI();
}

export function renderSPT() {
    const container = document.getElementById('coachContent');
    if(!container) return;

    document.querySelectorAll('#module-coach .archive-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('#module-coach .archive-btn')[1].classList.add('active');

    // KRONOMETRE / SAYAÇ HTML (Aynı yapıyı kullanıyoruz)
    const timerHTML = `
    <div style="background:rgba(0,0,0,0.3); padding:10px; border-radius:10px; border:1px solid #444; margin-bottom:15px; display:flex; flex-direction:column; align-items:center;">
        <div id="timerDisplay" style="font-size:32px; font-weight:bold; color:#d4af37; font-family:monospace; margin-bottom:5px; text-shadow: 0 0 10px rgba(212, 175, 55, 0.3);">00:00</div>
        <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap; justify-content:center;">
            <input type="number" id="timerInput" placeholder="Sn" style="width:60px; padding:8px; border-radius:5px; border:1px solid #555; background:#222; color:#fff; text-align:center; font-size:14px;">
            <button onclick="window.startTimer()" style="background:#4caf50; color:white; border:none; padding:8px 15px; border-radius:5px; cursor:pointer; font-weight:bold;">Başlat</button>
            <button onclick="window.stopTimer()" style="background:#f44336; color:white; border:none; padding:8px 15px; border-radius:5px; cursor:pointer; font-weight:bold;">Durdur</button>
            <button onclick="window.resetTimer()" style="background:#333; color:white; border:none; padding:8px 15px; border-radius:5px; cursor:pointer; font-weight:bold;">Sıfırla</button>
        </div>
        <div style="font-size:11px; color:#aaa; margin-top:5px; text-align:center;">(Süre girerseniz geri sayar, boş bırakırsanız kronometre çalışır)</div>
    </div>`;

    // Varsayılan SPT Listesi
    const defaultSPT = [
        { name: "Holding (Statik)", desc: "Yayı çek, 30sn bekle, 15sn dinlen. (4 Tekrar)" },
        { name: "Power (Patlayıcı)", desc: "Lastik ile 10 hızlı çekiş, 10sn dinlen." },
        { name: "Denge", desc: "Tek ayak üzerinde durarak çekiş yap." },
        { name: "Core Plank", desc: "Yan plank pozisyonunda 45sn bekle." },
        { name: "Scapula Push-up", desc: "Sadece kürek kemiklerini hareket ettirerek şınav." }
    ];

    let sptList = JSON.parse(localStorage.getItem('kemankesSPT'));
    if (!sptList || sptList.length === 0) {
        sptList = defaultSPT;
        localStorage.setItem('kemankesSPT', JSON.stringify(sptList));
    }

    // LİSTE KAPSAYICISI (SCROLL İÇİN)
    container.innerHTML = timerHTML; // Önce sayacı ekle
    
    const listDiv = document.createElement('div');
    listDiv.className = 'notes-list';
    listDiv.id = 'sptListContainer';
    listDiv.style.cssText = "max-height: 55vh; overflow-y: auto; padding: 5px; border: 1px solid #333; border-radius: 8px; background: rgba(0,0,0,0.2);";

    sptList.forEach((item, index) => {
        const card = document.createElement('div');
        card.className = 'note-card spt-card';
        card.draggable = true;
        card.dataset.index = index;
        card.style.position = 'relative';

        let imagesHtml = '';
        if(item.images && item.images.length > 0) {
            imagesHtml = `<div style="display:flex; gap:5px; margin-top:5px; flex-wrap:wrap;">`;
            item.images.forEach((img, imgIndex) => {
                imagesHtml += `<img src="${img}" onclick="window.openSPTImage(${index}, ${imgIndex})" style="width:40px; height:40px; object-fit:cover; border-radius:4px; cursor:pointer; border:1px solid #555;">`;
            });
            imagesHtml += `</div>`;
        }

        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <div style="display:flex; align-items:center; gap:10px; width:100%;">
                    <span class="drag-handle-spt" style="cursor:grab; font-size:20px; color:#666; padding:5px 10px 5px 0;">☰</span>
                    <div style="flex-grow:1;">
                        <div style="font-weight:bold; color:#d4af37; font-size:16px;">${item.name}</div>
                        <div style="color:#aaa; font-size:13px; margin-top:5px;">${item.desc}</div>
                        ${imagesHtml}
                    </div>
                </div>
                <button onclick="window.deleteSPT(${index})" style="background:none; border:none; color:#8b0000; cursor:pointer; font-size:14px; margin-left:5px;">🗑️</button>
            </div>
        `;

        // Sürükle Bırak Olayları
        card.addEventListener('dragstart', window.handleDragStartSPT);
        card.addEventListener('dragover', window.handleDragOverSPT);
        card.addEventListener('drop', window.handleDropSPT);
        card.addEventListener('dragend', window.handleDragEndSPT);

        const handle = card.querySelector('.drag-handle-spt');
        handle.addEventListener('touchstart', window.handleTouchStartSPTMobile, {passive: false});
        handle.addEventListener('touchmove', window.handleTouchMoveSPTMobile, {passive: false});
        handle.addEventListener('touchend', window.handleTouchEndSPTMobile);

        listDiv.appendChild(card);
    });
    
    container.appendChild(listDiv);

    const addBtn = document.createElement('button');
    addBtn.className = 'btn-add-note';
    addBtn.style.marginTop = '20px';
    addBtn.innerText = '+ Yeni Hareket Ekle';
    addBtn.onclick = window.addSPT;
    container.appendChild(addBtn);

    // Eğer sayaç çalışıyorsa UI'ı güncelle
    if(window.updateTimerUI) window.updateTimerUI();
}

export function openSPTModal() {
    document.getElementById('sptName').value = '';
    document.getElementById('sptDesc').value = '';
    document.getElementById('sptImagePreview').innerHTML = '';
    document.getElementById('sptImageInput').value = '';
    document.getElementById('sptModal').style.display = 'flex';
}

// GIF/RESİM AÇMA YARDIMCISI (VERİYİ LOCALSTORAGE'DAN ÇEKER)
export function openSPTImage(itemIndex, imgIndex) {
    const list = JSON.parse(localStorage.getItem('kemankesSPT')) || [];
    if(list[itemIndex] && list[itemIndex].images && list[itemIndex].images[imgIndex]) {
        openImageModal(list[itemIndex].images[imgIndex]);
    }
}

// --- ANTRENMAN DETAY MODALI (YENİ) ---
export function openHistoryDetailModal(item) {
    let modal = document.getElementById('historyDetailModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'historyDetailModal';
        modal.className = 'image-modal';
        modal.onclick = (e) => { if(e.target === modal) modal.style.display = 'none'; };
        document.body.appendChild(modal);
    }

    let detailsHtml = '';
    if (item.detailedShots && item.detailedShots.length > 0) {
        detailsHtml += '<h4 style="color:#d4af37; margin-bottom:10px; border-bottom:1px solid #333; padding-bottom:5px;">Atış Detayları</h4>';
        // 18m: 5'li Grid Yapısı
        detailsHtml += '<div style="display:grid; grid-template-columns: repeat(5, 1fr); gap:5px; justify-content:center;">';
        item.detailedShots.forEach(shot => {
            let color = '#aaa';
            let bg = 'transparent';
            if(shot.score === 3) { color = '#000'; bg = '#d4af37'; }
            else if(shot.score === 1) { color = '#000'; bg = '#e0e0e0'; }
            
            detailsHtml += `<div style="border:1px solid #555; padding:5px; border-radius:4px; text-align:center;">
                <div style="font-size:10px; color:#888; margin-bottom:2px;">${shot.label}</div>
                <div style="font-weight:bold; color:${color}; background:${bg}; border-radius:3px; padding:2px;">${shot.score}</div>
            </div>`;
        });
        detailsHtml += '</div>';
    } else if (item.hitLabels && item.hitLabels.length > 0) {
        detailsHtml += '<h4 style="color:#d4af37; margin-bottom:10px; border-bottom:1px solid #333; padding-bottom:5px;">İsabet Eden Oklar</h4>';
        
        // 70m: Gruplandırma ve Sıralama
        const counts = {};
        item.hitLabels.forEach(l => counts[l] = (counts[l] || 0) + 1);
        const sorted = Object.entries(counts).sort((a,b) => b[1] - a[1]); // Çoktan aza sırala

        detailsHtml += '<div style="display:flex; flex-wrap:wrap; gap:5px; justify-content:center;">';
        sorted.forEach(([label, count]) => {
            detailsHtml += `<span style="background:#d4af37; color:#000; padding:4px 8px; border-radius:4px; font-size:13px; font-weight:bold;">${label} <span style="font-size:10px; opacity:0.7;">(x${count})</span></span>`;
        });
        detailsHtml += '</div>';
    }

    modal.innerHTML = `
        <div class="modal-content" style="background:var(--card-bg); padding:20px; width:90%; max-width:400px; color:var(--text-color); border: 1px solid #d4af37; border-radius:12px; max-height:80vh; overflow-y:auto;">
            <span class="close-modal" onclick="document.getElementById('historyDetailModal').style.display='none'">&times;</span>
            <h2 style="color:#d4af37; margin-top:0; text-align:center;">Antrenman Detayı</h2>
            <div style="margin-bottom:20px; text-align:center;">
                <div style="font-size:14px; color:#888;">${item.date || 'Tarih Yok'} - ${item.time}</div>
                <div style="font-size:24px; font-weight:bold; margin-top:5px; color:#fff;">${item.score} Puan</div>
                <div style="font-size:14px; color:#aaa;">(${item.arrows} Ok - Ort: ${(item.score/item.arrows).toFixed(2)})</div>
                ${item.bowName ? `<div style="font-size:13px; color:#d4af37; margin-top:5px; border:1px solid #333; display:inline-block; padding:2px 8px; border-radius:10px;">🏹 ${item.bowName}</div>` : ''}
            </div>
            ${item.note ? `<div style="background:rgba(255,255,255,0.05); padding:15px; border-radius:8px; margin-bottom:20px; font-style:italic; border-left:3px solid #d4af37;">📝 ${item.note}</div>` : ''}
            ${detailsHtml}
            <div style="margin-top:20px; text-align:center;">
                <button onclick="document.getElementById('historyDetailModal').style.display='none'" class="btn-add-note" style="width:auto; padding:10px 40px;">Kapat</button>
            </div>
        </div>
    `;
    modal.style.display = 'flex';
}
