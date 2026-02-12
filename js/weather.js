// js/weather.js - V3.2 (AKILLI RÜZGAR ASİSTANI)

let windDirection = 0; // API'den gelen rüzgar yönü

export function toggleWeatherModal() {
    const modal = document.getElementById('weatherModal');
    const manualInput = document.getElementById('manualLocationInput');
    
    if (modal.style.display === 'flex') {
        modal.style.display = 'none';
        stopCompass(); // Modalı kapatınca pusulayı durdur
    } else {
        modal.style.display = 'flex';
        if(manualInput) manualInput.style.display = 'none'; 
        getWeatherData();
    }
}

export function getWeatherData() {
    const statusDiv = document.getElementById('weatherStatus');
    const manualInput = document.getElementById('manualLocationInput');
    statusDiv.innerHTML = "Konum alınıyor...";
    
    if (!navigator.geolocation) {
        statusDiv.innerHTML = "Tarayıcınız konum servisini desteklemiyor.";
        if(manualInput) manualInput.style.display = 'block';
        return;
    }

    navigator.geolocation.getCurrentPosition(async (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        fetchWeather(lat, lon);
        
        // Adres bulma
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1&accept_language=tr`);
            const data = await res.json();
            let locName = "Konum";
            if (data.address) {
                const addr = data.address;
                const parts = [addr.suburb || addr.neighbourhood, addr.town || addr.district || addr.county, addr.city || addr.province].filter(Boolean);
                if (parts.length > 0) locName = parts.join(", ");
                else locName = data.display_name.split(',')[0];
            }
            document.getElementById('weatherLocation').innerText = "📍 " + locName;
        } catch (e) {
            console.error("Adres bulunamadı:", e);
            document.getElementById('weatherLocation').innerText = "📍 Bilinmeyen Konum";
        }
        
    }, (err) => {
        console.warn("Konum hatası:", err);
        statusDiv.innerHTML = "Konum izni verilmedi. Lütfen şehir girin:";
        if(manualInput) manualInput.style.display = 'block';
    });
}

export async function getWeatherByCity() {
    const cityInput = document.getElementById('cityInput');
    const city = cityInput.value;
    if(!city) return;
    
    const statusDiv = document.getElementById('weatherStatus');
    statusDiv.innerHTML = "Aranıyor...";
    
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&addressdetails=1&limit=1&accept_language=tr`);
        const data = await res.json();
        
        if(!data || data.length === 0) { 
            statusDiv.innerHTML = "Bulunamadı. İlçe ve İl birlikte yazmayı deneyin."; 
            return; 
        }
        
        const loc = data[0];
        const lat = loc.lat;
        const lon = loc.lon;
        
        let locName = loc.name || "";
        if (loc.address) {
            const addr = loc.address;
            const parts = [addr.suburb || addr.neighbourhood, addr.town || addr.district || addr.county, addr.city || addr.province].filter(Boolean);
            if (parts.length > 0) locName = parts.join(", ");
        }
        if (!locName) locName = loc.display_name.split(',')[0];

        document.getElementById('weatherLocation').innerText = "📍 " + locName;
        fetchWeather(lat, lon);
        
        const manualInput = document.getElementById('manualLocationInput');
        if(manualInput) manualInput.style.display = 'none';
        
    } catch(e) { 
        console.error(e);
        statusDiv.innerHTML = "Bağlantı hatası."; 
    }
}

async function fetchWeather(lat, lon) {
    const statusDiv = document.getElementById('weatherStatus');
    try {
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m,wind_direction_10m`);
        const data = await res.json();
        
        if (!data.current) {
            statusDiv.innerHTML = "Hava durumu verisi alınamadı.";
            return;
        }

        const current = data.current;
        windDirection = current.wind_direction_10m; // Global değişkene ata

        // Rüzgar Şiddetine Göre Halka Rengi
        const windSpeed = current.wind_speed_10m;
        let ringColor = "#4caf50"; // Yeşil (Hafif)
        if (windSpeed > 25) ringColor = "#f44336"; // Kırmızı (Sert)
        else if (windSpeed > 15) ringColor = "#ff9800"; // Turuncu (Orta)

        const compassContainer = document.getElementById('compassContainer');
        if(compassContainer) {
            compassContainer.style.borderColor = ringColor;
            compassContainer.style.boxShadow = `inset 0 0 20px #000, 0 0 15px ${ringColor}`; // Dışa doğru hafif parlama
        }

        const temp = current.temperature_2m;
        const pressure = current.surface_pressure;
        const pressureAlt = 44330.8 * (1 - Math.pow(pressure / 1013.25, 0.190263));
        const isaTemp = 15 - (0.0065 * pressureAlt);
        const densityAlt = pressureAlt + (36.6 * (temp - isaTemp));

        document.getElementById('weatherTemp').innerText = Math.round(temp) + "°C";
        document.getElementById('weatherWindSpeed').innerText = Math.round(current.wind_speed_10m) + " km/s";
        document.getElementById('weatherPressure').innerText = Math.round(pressure) + " hPa";
        document.getElementById('weatherDA').innerText = Math.round(densityAlt) + " m";
        
        // Rüzgar Oku (Statik Görünüm)
        const arrow = document.getElementById('windArrowIcon');
        if(arrow) {
            arrow.style.transform = `translate(-50%, -50%) rotate(${current.wind_direction_10m}deg)`;
        }
        
        let tip = "";
        if (densityAlt < 800) tip = "❄️ Hava Yoğun (Çorba): Oklar 'Paraşüt Etkisi' ile yavaşlayıp aşağı düşebilir. Nişanı biraz yukarı al.";
        else if (densityAlt > 1400) tip = "🔥 Hava İnce: Oklar daha az sürtünmeyle süzülür (Gliding). Nişanı biraz aşağı al.";
        else tip = "✅ Hava Normal: Standart nişan ve teknikle atış yapabilirsin.";
        
        if (current.wind_speed_10m > 20) {
            tip += " ⚠️ Rüzgar sert! Atış aralarını kolla.";
        }

        document.getElementById('weatherTip').innerText = "💡 " + tip;
        document.getElementById('weatherContent').style.display = 'block';
        statusDiv.innerHTML = "";
        
    } catch(e) { 
        console.error(e);
        statusDiv.innerHTML = "Veri alınamadı."; 
    }
}

// --- PUSULA & RÜZGAR ASİSTANI ---
let compassListener = null;

export function startCompass() {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        // iOS 13+ için izin isteği
        DeviceOrientationEvent.requestPermission()
            .then(response => {
                if (response === 'granted') {
                    enableCompass();
                } else {
                    alert("Pusula izni reddedildi.");
                }
            })
            .catch(console.error);
    } else {
        // Android ve eski cihazlar
        enableCompass();
    }
}

function enableCompass() {
    if (compassListener) return; // Zaten çalışıyorsa çık

    compassListener = (e) => {
        let heading = 0;
        if (e.webkitCompassHeading) {
            // iOS
            heading = e.webkitCompassHeading;
        } else if (e.alpha) {
            // Android (alpha kuzey değilse offset gerekebilir ama genelde yeterli)
            heading = 360 - e.alpha;
        }

        // Pusula görselini döndür (Kuzeyi yukarıda tutmak için ters döndür)
        const compassContainer = document.getElementById('compassContainer');
        if(compassContainer) {
            compassContainer.style.transform = `rotate(${-heading}deg)`;
        }

        // Rüzgar Analizi
        calculateWindAdvice(heading);
    };

    window.addEventListener('deviceorientation', compassListener, true);
    document.getElementById('btnCalibrateCompass').innerText = "✅ Pusula Aktif (Telefonu Hedefe Tut)";
    document.getElementById('btnCalibrateCompass').style.background = "#4caf50";
}

function stopCompass() {
    if (compassListener) {
        window.removeEventListener('deviceorientation', compassListener, true);
        compassListener = null;
        document.getElementById('btnCalibrateCompass').innerText = "🧭 Rüzgar Yönünü Eşitle (Kalibre Et)";
        document.getElementById('btnCalibrateCompass').style.background = "#333";
    }
}

function calculateWindAdvice(heading) {
    // Rüzgarın geldiği yön (Meteorolojik) - Bizim baktığımız yön (Heading)
    // Farkı alarak rüzgarın bize göre nereden geldiğini buluyoruz.
    // Örn: Rüzgar 90 (Doğu), Biz 0 (Kuzey). Fark 90. Rüzgar sağdan.
    
    let relativeWind = (windDirection - heading + 360) % 360;
    
    let advice = "";
    let color = "#d4af37";

    // Tolerans aralığı +/- 45 derece
    if (relativeWind >= 45 && relativeWind < 135) {
        advice = "🌬️ Rüzgar SAĞDAN Vuruyor -> SAĞA Nişan Al (İçine At)";
        color = "#f44336"; // Kırmızı uyarı
    } else if (relativeWind >= 225 && relativeWind < 315) {
        advice = "🌬️ Rüzgar SOLDAN Vuruyor -> SOLA Nişan Al (İçine At)";
        color = "#f44336";
    } else if (relativeWind >= 315 || relativeWind < 45) {
        advice = "🌬️ Rüzgar KARŞIDAN (Headwind) -> Nişanı Düşür";
        color = "#2196f3";
    } else {
        advice = "🌬️ Rüzgar ARKADAN (Tailwind) -> Nişanı Kaldır"; // Genelde okçulukta arkadan rüzgar oku basar
        color = "#4caf50";
    }

    const tipEl = document.getElementById('weatherTip');
    if(tipEl) {
        tipEl.innerText = advice;
        tipEl.style.color = color;
        tipEl.style.fontWeight = "bold";
    }
}

// Global'e bağla
window.startCompass = startCompass;
