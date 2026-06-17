// ==========================================
// 1. INITIALIZE THE LITE MAP CANVAS
// ==========================================
const map = L.map('map', {
    zoomControl: false 
}).setView([39.8283, -98.5795], 4); 

// Sleek Light Voyager theme - optimized for colorful radar overlays
L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 20
}).addTo(map);

L.control.zoom({ position: 'topright' }).addTo(map);

let radarLayers = [];
let currentFrameIndex = 0;
let animationInterval = null;
const frameDuration = 800; 

// ==========================================
// 2. HIGH-AVAILABILITY RELATIVE TIME ENGINE
// ==========================================
function loadFallbackRadar() {
    console.log("Engaging high-availability IEM relative-time loop...");
    document.getElementById('loop-timestamp').innerText = "Looping...";

    radarLayers.forEach(layer => map.removeLayer(layer));
    radarLayers = [];

    // The working sequence supported by the relative time server endpoint
    const iemRelativeLayers = [
        { layerName: 'nexrad-n0q-900913-m15m', label: '-15m' },
        { layerName: 'nexrad-n0q-900913-m10m', label: '-10m' },
        { layerName: 'nexrad-n0q-900913-m05m', label: '-5m' },
        { layerName: 'nexrad-n0q-900913',      label: 'Live' }
    ];

    iemRelativeLayers.forEach((config) => {
        const layer = L.tileLayer.wms('https://mesonet.agron.iastate.edu/cgi-bin/wms/nexrad/n0q.cgi', {
            layers: config.layerName,
            format: 'image/png',
            transparent: true,
            opacity: 0, 
            attribution: 'Radar &copy; IEM / NOAA'
        }).addTo(map);

        radarLayers.push({ layer: layer, timeLabel: config.label });
    });

    currentFrameIndex = 0;
    radarLayers[0].layer.setOpacity(0.65);
    document.getElementById('loop-timestamp').innerText = radarLayers[0].timeLabel;
    
    document.getElementById('play-btn').disabled = false;
    setupAnimationControls();
}

// ==========================================
// 3. PRIMARY RADAR FETCHING SYSTEM
// ==========================================
async function loadLiveRadar() {
    try {
        const response = await fetch('https://api.rainviewer.com/public/maps.json');
        const data = await response.json();
        
        const timestamps = data.past || data.radar || data;

        if (!timestamps || !Array.isArray(timestamps) || timestamps.length === 0) {
            console.warn("Primary API unavailable. Activating relative loop backup...");
            loadFallbackRadar();
            return;
        }

        radarLayers.forEach(layer => map.removeLayer(layer));
        radarLayers = [];

        const recentTimestamps = timestamps.slice(-4);

        recentTimestamps.forEach((frame) => {
            const timeValue = frame.time || frame;
            
            const layer = L.tileLayer(`https://tilecache.rainviewer.com/v2/radar/${timeValue}/256/{z}/{x}/{y}/2/1_1.png`, {
                maxZoom: 18,
                opacity: 0,
                attribution: 'Radar &copy; RainViewer'
            }).addTo(map);

            const date = new Date(timeValue * 1000);
            const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

            radarLayers.push({ layer: layer, timeLabel: timeString });
        });

        showFrame(0);
        setupAnimationControls();

    } catch (error) {
        console.error("Primary API network error. Activating relative loop backup...", error);
        loadFallbackRadar();
    }
}

function showFrame(index) {
    if (radarLayers.length === 0 || !radarLayers[index]) return;

    radarLayers[currentFrameIndex].layer.setOpacity(0);
    currentFrameIndex = index;
    radarLayers[currentFrameIndex].layer.setOpacity(0.65);
    document.getElementById('loop-timestamp').innerText = radarLayers[currentFrameIndex].timeLabel;
}

// ==========================================
// 4. ANIMATION INTERFACE CONTROL ENGINE
// ==========================================
function setupAnimationControls() {
    const playBtn = document.getElementById('play-btn');
    
    playBtn.onclick = null; 
    
    playBtn.onclick = () => {
        if (animationInterval) {
            clearInterval(animationInterval);
            animationInterval = null;
            playBtn.innerText = "▶ Play Loop";
        } else {
            playBtn.innerText = "⏸ Pause";
            
            if (radarLayers.length === 0) {
                console.error("Cannot animate: radarLayers array is empty!");
                return;
            }

            animationInterval = setInterval(() => {
                let nextFrame = (currentFrameIndex + 1) % radarLayers.length;
                showFrame(nextFrame);
            }, frameDuration);
        }
    };
}

// ==========================================
// 5. HARDWARE GEOLOCATION SYSTEM
// ==========================================
let locationMarker = null;

document.getElementById('location-btn').onclick = () => {
    if (!navigator.geolocation) {
        alert("Geolocation tracking is not supported by your browser device.");
        return;
    }

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;

            map.setView([lat, lng], 8);

            if (locationMarker) map.removeLayer(locationMarker);

            locationMarker = L.circleMarker([lat, lng], {
                radius: 8,
                color: '#007bff',
                fillColor: '#007bff',
                fillOpacity: 0.8,
                weight: 2
            }).addTo(map).bindPopup("You are here").openPopup();
        },
        (error) => {
            console.error("GPS hardware target acquisition failed:", error);
            alert("Unable to retrieve position. Please ensure location services are enabled.");
        },
        { enableHighAccuracy: true }
    );
};

// ==========================================
// 6. RUN INITIALIZATION & RE-FIT WINDOW BOUNDS
// ==========================================
loadLiveRadar();

setTimeout(() => {
    map.invalidateSize();
    console.log("Map layout successfully refreshed and aligned!");
}, 800);
