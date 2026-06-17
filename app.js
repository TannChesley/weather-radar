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
const frameDuration = 700; // Snappy loop speed for 8 frames

// ==========================================
// 2. DYNAMIC 8-FRAME VALIDATED TIME ENGINE
// ==========================================
function loadFallbackRadar() {
    console.log("Engaging dynamic 8-frame validated archive loop...");
    document.getElementById('loop-timestamp').innerText = "Looping...";

    radarLayers.forEach(layer => map.removeLayer(layer));
    radarLayers = [];

    // Calculate the most recent completed 5-minute block in UTC time
    const now = new Date();
    
    // Step back 15 minutes from right now to ensure the images have finished rendering on the server
    let targetTime = new Date(now.getTime() - (15 * 60 * 1000));
    
    // Round down to the nearest 5-minute mark
    let minutes = Math.floor(targetTime.getUTCMinutes() / 5) * 5;
    
    // Build an array of 8 consecutive 5-minute intervals going backward
    let frameTimes = [];
    for (let i = 0; i < 8; i++) {
        let loopTime = new Date(targetTime.getTime() - (i * 5 * 60 * 1000));
        let loopMinutes = Math.floor(loopTime.getUTCMinutes() / 5) * 5;
        loopTime.setUTCMinutes(loopMinutes);
        loopTime.setUTCSeconds(0);
        frameTimes.unshift(loopTime); // Put oldest frames first so the loop plays forward
    }

    // Spin up the 8 layers using the precise historical timestamps
    frameTimes.forEach((frameTime) => {
        let year = frameTime.getUTCFullYear();
        let month = String(frameTime.getUTCMonth() + 1).padStart(2, '0');
        let day = String(frameTime.getUTCDate()).padStart(2, '0');
        let hours = String(frameTime.getUTCHours()).padStart(2, '0');
        let mins = String(frameTime.getUTCMinutes()).padStart(2, '0');
        
        let iemTimeString = `${year}-${month}-${day}T${hours}:${mins}:00Z`;
        console.log("Requesting Validated Frame:", iemTimeString);

        const layer = L.tileLayer.wms('https://mesonet.agron.iastate.edu/cgi-bin/wms/nexrad/n0q-t.cgi', {
            layers: 'nexrad-n0q-900913',
            time: iemTimeString,
            format: 'image/png',
            transparent: true,
            opacity: 0, 
            attribution: 'Radar &copy; IEM / NOAA'
        }).addTo(map);

        // UI Label: Display the time converted nicely to your local wall-clock time
        let localTimeString = frameTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        
        radarLayers.push({ layer: layer, timeLabel: localTimeString });
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
            console.warn("Primary API unavailable. Activating dynamic archive loop...");
            loadFallbackRadar();
            return;
        }

        radarLayers.forEach(layer => map.removeLayer(layer));
        radarLayers = [];

        // Match primary engine to 8 frames
        const recentTimestamps = timestamps.slice(-8);

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
        console.error("Primary network error. Activating dynamic archive loop...", error);
        loadFallbackRadar();
    }
}

// Frame switching mechanics
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
// 6. RUN INITIALIZATION
// ==========================================
loadLiveRadar();

setTimeout(() => {
    map.invalidateSize();
    console.log("Map layout successfully refreshed and aligned!");
}, 800);