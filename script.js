document.addEventListener('DOMContentLoaded', () => {

  // State
  let currentSelectedLot = null;
  let selectedVehicleType = null; // 'two-wheeler' | 'four-wheeler'

  // ---- Persistent Session Check ----
  const SESSION_KEY = 'parking_session';

  function saveSession(email) {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ email, ts: Date.now() }));
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  function getSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch(e) { return null; }
  }
  const mockParkingData = [
    { id: 1, name: "TrustPark - City Center Plaza", address: "MG Road, Central Business District", dist: "0.2 km", available: 14, total: 150, lat: 12.9767, lng: 77.5946 },
    { id: 2, name: "Secure-O-Park - South Block", address: "Brigade Road, South Zone", dist: "0.5 km", available: 3, total: 200, lat: 12.9710, lng: 77.6111 },
    { id: 3, name: "Access Parking - Sky Hub", address: "Indiranagar 80ft Road", dist: "0.8 km", available: 45, total: 80, lat: 12.9719, lng: 77.6412 },
    { id: 4, name: "AutoPark - North Station", address: "Main Railway Station, North Wing", dist: "1.2 km", available: 112, total: 500, lat: 12.9784, lng: 77.5684 }
  ];

  // DOM Elements
  const analyticsTitle = document.getElementById('analyticsTitle');
  const statAvailable = document.getElementById('statAvailable');
  const statFull = document.getElementById('statFull');
  const statTotal = document.getElementById('statTotal');
  const simulationControls = document.getElementById('simulationControls');
  
  const parkingList = document.getElementById('parkingList');
  let searchPerformed = false;

  const latValue = document.getElementById('latValue');
  const lngValue = document.getElementById('lngValue');
  const accValue = document.getElementById('accValue');
  const btnDirections = document.getElementById('btnDirections');
  const btnStartNav = document.getElementById('btnStartNav');
  const directionsWrapper = document.getElementById('directionsWrapper');
  const analyticsLocation = document.getElementById('analyticsLocation');
  const parkingSearch = document.getElementById('parkingSearch');

  let searchQuery = '';
  let map = null;
  let markers = [];
  let userMarker = null;
  let currentRoute = null;
  let rideCoords = [];       // flat LatLng[] from routesfound
  let rideInstructions = []; // turn instructions from routesfound
  let rideStepIndex = 0;
  let rideTimer = null;
  let isRiding = false;

  const btnSearch = document.getElementById('btnSearch');

  async function doSearch() {
    if (!parkingSearch) return;
    const val = parkingSearch.value.trim();
    if (!val) {
      searchQuery = '';
      renderParkingList();
      return;
    }

    try {
      if (btnSearch) btnSearch.innerText = '...';
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(val)}`);
      const data = await res.json();

      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);
        
        searchQuery = ''; 
        parkingSearch.value = data[0].display_name.split(',')[0]; 
        
        performParkingSearch(lat, lng, true);
      } else {
        searchQuery = val.toLowerCase();
        renderParkingList();
      }
    } catch(e) {
      console.warn('Geocode error', e);
      searchQuery = val.toLowerCase();
      renderParkingList();
    } finally {
      if (btnSearch) btnSearch.innerText = 'Search';
    }
  }

  if (parkingSearch) {
    parkingSearch.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        doSearch();
      }
    });
  }

  if (btnSearch) {
    btnSearch.addEventListener('click', doSearch);
  }

  // --- Login Logic ---
  const loginView = document.getElementById('loginView');
  const dashboardView = document.getElementById('dashboardView');
  const loginForm = document.getElementById('loginForm');
  const btnGoogleLogin = document.getElementById('btnGoogleLogin');
  const togglePasswordBtn = document.getElementById('togglePassword');
  const loginPasswordInput = document.getElementById('loginPassword');
  
  const authTitle = document.getElementById('authTitle');
  const authSubmitBtn = document.getElementById('authSubmitBtn');
  const toggleAuthMode = document.getElementById('toggleAuthMode');
  const toggleAuthWrapper = document.getElementById('toggleAuthWrapper');
  let isSignUpMode = false;

  function bindToggleClick() {
    const toggleBtn = document.getElementById('toggleAuthMode');
    if (!toggleBtn) return;
    
    toggleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      isSignUpMode = !isSignUpMode;
      const errorMsg = document.getElementById('loginError');
      if (errorMsg) {
          errorMsg.style.display = 'none';
          errorMsg.style.color = '#ff6b6b';
      }
      
      if (isSignUpMode) {
        authTitle.innerText = 'Create Account';
        authSubmitBtn.innerText = 'Sign Up';
        toggleAuthWrapper.innerHTML = `Already have an account? <a href="#" id="toggleAuthMode" style="color: var(--accent-color); text-decoration: none;">Sign In</a>`;
      } else {
        authTitle.innerText = 'Sign In to Dashboard';
        authSubmitBtn.innerText = 'Sign In';
        toggleAuthWrapper.innerHTML = `Don't have an account? <a href="#" id="toggleAuthMode" style="color: var(--accent-color); text-decoration: none;">Sign Up</a>`;
      }
      bindToggleClick(); // re-bind listener
    });
  }
  
  bindToggleClick();

  if (togglePasswordBtn && loginPasswordInput) {
    togglePasswordBtn.addEventListener('click', () => {
      const type = loginPasswordInput.getAttribute('type') === 'password' ? 'text' : 'password';
      loginPasswordInput.setAttribute('type', type);
      
      if (type === 'text') {
        togglePasswordBtn.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>';
      } else {
        togglePasswordBtn.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
      }
    });
  }

  const vehicleSelectionView = document.getElementById('vehicleSelectionView');
  const btnConfirmVehicle = document.getElementById('btnConfirmVehicle');
  const vehicleTagDisplay = document.getElementById('vehicleTagDisplay');
  const vehicleError = document.getElementById('vehicleError');

  // Global so onclick="selectVehicle(...)" in HTML can access it
  window.selectVehicle = function(type) {
    selectedVehicleType = type;
    document.getElementById('card2W').classList.remove('selected-2w', 'selected-4w');
    document.getElementById('card4W').classList.remove('selected-2w', 'selected-4w');
    if (vehicleError) vehicleError.style.display = 'none';
    if (type === 'two-wheeler') {
      document.getElementById('card2W').classList.add('selected-2w');
    } else {
      document.getElementById('card4W').classList.add('selected-4w');
    }
  };

  if (btnConfirmVehicle) {
    btnConfirmVehicle.addEventListener('click', () => {
      if (!selectedVehicleType) {
        if (vehicleError) vehicleError.style.display = 'block';
        return;
      }
      if (vehicleTagDisplay) {
        vehicleTagDisplay.style.display = 'inline-block';
        if (selectedVehicleType === 'two-wheeler') {
          vehicleTagDisplay.textContent = '\uD83C\uDFCD\uFE0F Two Wheeler';
          vehicleTagDisplay.className = 'vehicle-tag tag-2w';
        } else {
          vehicleTagDisplay.textContent = '\uD83D\uDE97 Four Wheeler';
          vehicleTagDisplay.className = 'vehicle-tag tag-4w';
        }
      }
      vehicleSelectionView.style.opacity = '0';
      vehicleSelectionView.style.transform = 'scale(0.95)';
      vehicleSelectionView.style.transition = 'all 0.4s ease';
      setTimeout(() => {
        vehicleSelectionView.style.display = 'none';
        if (dashboardView) dashboardView.style.display = 'flex';
        if (map) map.invalidateSize();
        initGeolocation();
      }, 400);
    });
  }

  function showVehicleSelection() {
    if (loginView) loginView.style.display = 'none';
    if (vehicleSelectionView) {
      vehicleSelectionView.style.display = 'flex';
      vehicleSelectionView.style.opacity = '1';
      vehicleSelectionView.style.transform = 'scale(1)';
    }
  }

  function showDashboard(e) {
    if (e) e.preventDefault();
    if (!selectedVehicleType) {
      if (loginView) {
        loginView.style.opacity = '0';
        loginView.style.transform = 'scale(0.95)';
        loginView.style.transition = 'all 0.4s ease';
        setTimeout(() => {
          loginView.style.display = 'none';
          showVehicleSelection();
        }, 400);
      } else {
        showVehicleSelection();
      }
      return;
    }
    if (loginView) {
      loginView.style.opacity = '0';
      loginView.style.transform = 'scale(0.95)';
      loginView.style.transition = 'all 0.4s ease';
      setTimeout(() => {
        loginView.style.display = 'none';
        if (dashboardView) dashboardView.style.display = 'flex';
        if (map) map.invalidateSize();
        initGeolocation();
      }, 400);
    }
  }

  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('loginId').value.trim();
        const pass = document.getElementById('loginPassword').value;
        const errorMsg = document.getElementById('loginError');

        if (isSignUpMode) {
             if (email.length < 3 || pass.length < 4) {
                 errorMsg.style.display = 'block';
                 errorMsg.style.color = '#ff6b6b';
                 errorMsg.innerText = 'Email must be at least 3 chars and password at least 4 chars.';
                 return;
             }
             // Get existing users
             let users = JSON.parse(localStorage.getItem('parking_users') || "{}");
             if (users[email]) {
                 errorMsg.style.display = 'block';
                 errorMsg.style.color = '#ff6b6b';
                 errorMsg.innerText = 'Account with this email/mobile already exists.';
                 return;
             }
             users[email] = pass;
             localStorage.setItem('parking_users', JSON.stringify(users));

             document.getElementById('toggleAuthMode').click(); // switch back to sign in
             
             // Show success
             const newErrorMsg = document.getElementById('loginError');
             newErrorMsg.style.display = 'block';
             newErrorMsg.style.color = '#20c997'; 
             newErrorMsg.innerText = 'Account created successfully! Please Sign In.';
             
             document.getElementById('loginId').value = email;
             document.getElementById('loginPassword').value = '';
        } else {
             let users = JSON.parse(localStorage.getItem('parking_users') || "{}");
             
             if ((email === 'admin' && pass === 'password') || (users[email] && users[email] === pass)) {
                 errorMsg.style.display = 'none';
                 saveSession(email); // <-- persist session
                 showDashboard();
             } else {
                 errorMsg.style.display = 'block';
                 errorMsg.style.color = '#ff6b6b';
                 errorMsg.innerText = 'Mobile/Email and password do not match. Please try again.';
             }
        }
    });
  }

  // Logout logic
  function logout() {
    clearSession();
    selectedVehicleType = null;
    if (dashboardView) dashboardView.style.display = 'none';
    if (vehicleSelectionView) vehicleSelectionView.style.display = 'none';
    if (loginView) {
      loginView.style.display = 'flex';
      loginView.style.opacity = '1';
      loginView.style.transform = 'scale(1)';
    }
    // Reset vehicle card selection UI
    const c2 = document.getElementById('card2W');
    const c4 = document.getElementById('card4W');
    if (c2) c2.classList.remove('selected-2w', 'selected-4w');
    if (c4) c4.classList.remove('selected-2w', 'selected-4w');
    const vtag = document.getElementById('vehicleTagDisplay');
    if (vtag) { vtag.style.display = 'none'; vtag.textContent = ''; }
  }

  const btnLogout = document.getElementById('btnLogout');
  if (btnLogout) btnLogout.addEventListener('click', logout);

  // ---- Auto-login from session ----
  const session = getSession();
  if (session && session.email) {
    // Session exists — skip login, go straight to vehicle selection (or dashboard if vehicle already picked)
    if (loginView) loginView.style.display = 'none';
    if (vehicleSelectionView) {
      vehicleSelectionView.style.display = 'flex';
      vehicleSelectionView.style.opacity = '1';
      vehicleSelectionView.style.transform = 'scale(1)';
    }
  }
  if (btnGoogleLogin) btnGoogleLogin.addEventListener('click', showDashboard);

  // Logic: Dashboard Analytics Display
  function updateAnalyticsDisplay(autoUpdate = false) {
    if (!currentSelectedLot) return;
    
    analyticsTitle.innerText = currentSelectedLot.name;
    if (analyticsLocation) {
        analyticsLocation.innerText = `📍 ${currentSelectedLot.address}`;
    }

    statAvailable.innerText = currentSelectedLot.available;
    statFull.innerText = currentSelectedLot.total - currentSelectedLot.available;
    statTotal.innerText = currentSelectedLot.total;
    
    simulationControls.style.display = 'block';

    // Animation effect
    statAvailable.style.transform = 'scale(1.2)';
    setTimeout(() => {
      statAvailable.style.transform = 'scale(1)';
    }, 150);

    // Update list UI to match
    renderParkingList();

    // Map logic - only fly if not an automatic traffic background update
    if (!autoUpdate && map && currentSelectedLot.lat && currentSelectedLot.lng) {
      map.flyTo([currentSelectedLot.lat, currentSelectedLot.lng], 16, { animate: true, duration: 1 });
      
      if (currentRoute) {
        map.removeControl(currentRoute);
      }
      
      if (L.Routing) {
        currentRoute = L.Routing.control({
          waypoints: [
            L.latLng(currentLat, currentLng),
            L.latLng(currentSelectedLot.lat, currentSelectedLot.lng)
          ],
          createMarker: function() { return null; },
          lineOptions: {
            styles: [{color: '#00d2ff', opacity: 0.8, weight: 6}]
          },
          show: false,
          addWaypoints: false,
          draggableWaypoints: false,
          fitSelectedRoutes: true,
          showAlternatives: false
        }).addTo(map);

        // Capture route coordinates when found
        currentRoute.on('routesfound', function(e) {
          const route = e.routes[0];
          rideCoords = route.coordinates;        // array of LatLng
          rideInstructions = route.instructions; // turn-by-turn
        });
      }

      if (directionsWrapper) {
        directionsWrapper.style.display = 'flex';
        btnDirections.href = `https://www.google.com/maps/dir/?api=1&origin=${currentLat},${currentLng}&destination=${currentSelectedLot.lat},${currentSelectedLot.lng}`;
      }

      const googleMapIframe = document.getElementById('googleMap');
      const leafletMap = document.getElementById('map');
      if (googleMapIframe && leafletMap) {
        leafletMap.style.display = 'block';
        googleMapIframe.style.display = 'none';
      }
    }
  }

  // ---- Ride Simulation ----
  function getDirectionArrow(type) {
    const arrows = {
      'SlightRight': '↗', 'Right': '→', 'SharpRight': '↘',
      'SlightLeft': '↖',  'Left': '←',  'SharpLeft': '↙',
      'Straight': '↑', 'DestinationReached': '🏁',
      'Roundabout': '↻', 'WaypointReached': '★'
    };
    return arrows[type] || '↑';
  }

  function formatDist(meters) {
    return meters >= 1000 ? (meters/1000).toFixed(1) + ' km' : Math.round(meters) + ' m';
  }

  function formatTime(seconds) {
    if (seconds < 60) return seconds + ' sec';
    const m = Math.floor(seconds / 60);
    return m < 60 ? m + ' min' : Math.floor(m/60) + 'h ' + (m%60) + 'm';
  }

  function startRideSimulation() {
    if (rideCoords.length < 2) {
      alert('Route not ready yet. Please wait a moment and try again.');
      return;
    }
    if (isRiding) return;
    isRiding = true;
    rideStepIndex = 0;

    const hud = document.getElementById('rideHUD');
    const hudText = document.getElementById('hudText');
    const hudIcon = document.getElementById('hudIcon');
    const hudDist = document.getElementById('hudDist');
    const hudTime = document.getElementById('hudTime');
    if (hud) hud.style.display = 'block';

    // Show Leaflet map during ride
    const googleMapIframe = document.getElementById('googleMap');
    const leafletMap = document.getElementById('map');
    if (leafletMap) leafletMap.style.display = 'block';
    if (googleMapIframe) googleMapIframe.style.display = 'none';
    if (map) map.invalidateSize();

    const totalPoints = rideCoords.length;
    const SPEED_PPS = 12; // points per tick (controls playback speed)
    const TICK_MS = 150;  // ms per tick

    // Build instruction lookup by coordinate index
    let instrIdx = 0;

    function tick() {
      if (!isRiding || rideStepIndex >= totalPoints) {
        finishRide();
        return;
      }

      const coord = rideCoords[rideStepIndex];
      const lat = coord.lat;
      const lng = coord.lng;

      // Move marker
      if (userMarker) userMarker.setLatLng([lat, lng]);
      if (map) map.panTo([lat, lng], { animate: true, duration: 0.1 });

      // Update lat/lng displays
      if (latValue) latValue.innerText = lat.toFixed(6);
      if (lngValue) lngValue.innerText = lng.toFixed(6);

      // Remaining distance (straight-line approximation)
      const dest = rideCoords[totalPoints - 1];
      const dLat = (lat - dest.lat) * 111000;
      const dLng = (lng - dest.lng) * 111000 * Math.cos(lat * Math.PI / 180);
      const distLeft = Math.sqrt(dLat*dLat + dLng*dLng);
      const speed = 30; // km/h sim
      const timeLeft = (distLeft / (speed * 1000 / 3600));
      if (hudDist) hudDist.innerText = formatDist(distLeft);
      if (hudTime) hudTime.innerText = formatTime(Math.round(timeLeft));

      // Update instruction text
      if (rideInstructions && rideInstructions.length) {
        // Find current instruction
        while (instrIdx < rideInstructions.length - 1 &&
               rideInstructions[instrIdx].index <= rideStepIndex) {
          instrIdx++;
        }
        const instr = rideInstructions[instrIdx];
        if (instr) {
          if (hudIcon) hudIcon.innerText = getDirectionArrow(instr.type);
          if (hudText) hudText.innerText = instr.text || 'Continue straight';
        }
      } else {
        if (hudText) hudText.innerText = 'Navigating to ' + (currentSelectedLot ? currentSelectedLot.name : 'destination');
      }

      rideStepIndex += SPEED_PPS;
      rideTimer = setTimeout(tick, TICK_MS);
    }

    tick();
  }

  function stopRide() {
    isRiding = false;
    if (rideTimer) clearTimeout(rideTimer);
    const hud = document.getElementById('rideHUD');
    if (hud) hud.style.display = 'none';
  }

  function finishRide() {
    isRiding = false;
    if (rideTimer) clearTimeout(rideTimer);
    const hud = document.getElementById('rideHUD');
    if (hud) hud.style.display = 'none';

    // Move marker to exact destination
    if (currentSelectedLot && userMarker) {
      userMarker.setLatLng([currentSelectedLot.lat, currentSelectedLot.lng]);
    }

    // Show arrived banner
    const banner = document.createElement('div');
    banner.className = 'arrived-banner';
    banner.innerHTML = `
      <h2>🏁 You've Arrived!</h2>
      <p>Welcome to <strong>${currentSelectedLot ? currentSelectedLot.name : 'your destination'}</strong></p>
      <button class="btn btn-login" style="width:100%;" onclick="this.closest('.arrived-banner').remove()">OK</button>
    `;
    document.body.appendChild(banner);
  }

  // Wire up Start button — opens Google Maps AND starts internal simulation
  if (btnStartNav) {
    btnStartNav.addEventListener('click', (e) => {
      e.preventDefault();
      if (!currentSelectedLot || !currentSelectedLot.lat || !currentSelectedLot.lng) {
        alert('Please select a parking lot first.');
        return;
      }
      
      // 1. Start internal dashboard simulation
      startRideSimulation();
      
      // 2. Open external Google Maps for live navigation
      const url = `https://www.google.com/maps/dir/?api=1` +
        `&origin=${currentLat},${currentLng}` +
        `&destination=${currentSelectedLot.lat},${currentSelectedLot.lng}` +
        `&travelmode=driving` +
        `&dir_action=navigate`;
      window.open(url, '_blank');
    });
  }

  const btnStopRide = document.getElementById('btnStopRide');
  if (btnStopRide) btnStopRide.addEventListener('click', stopRide);


  // Logic: Parking Availability Search
  let currentLat = 0; 
  let currentLng = 0;

  function renderParkingList() {
    // Keep scanning UI if not performed
    if (!searchPerformed) return; 

    parkingList.innerHTML = ''; // Clear
    
    // Filter logic
    const filteredLots = mockParkingData.filter(lot => 
      lot.name.toLowerCase().includes(searchQuery) || 
      lot.address.toLowerCase().includes(searchQuery)
    );

    if (filteredLots.length === 0) {
      parkingList.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--text-secondary);">No matching parking locations found.</div>';
      return;
    }

    filteredLots.forEach(lot => {
      const item = document.createElement('div');
      item.className = 'parking-item';
      if (currentSelectedLot && currentSelectedLot.id === lot.id) {
          item.classList.add('active-lot');
      }
      
      // Select the lot
      item.onclick = () => {
        currentSelectedLot = lot;
        updateAnalyticsDisplay();
      };

      // Double click to get directions
      item.ondblclick = () => {
        if (lot.lat && lot.lng) {
          const url = `https://www.google.com/maps/dir/?api=1&origin=${currentLat},${currentLng}&destination=${lot.lat},${lot.lng}`;
          window.open(url, '_blank');
        }
      };

      item.innerHTML = `
        <div class="parking-info">
          <h3>${lot.name}</h3>
          <p>Distance: ${lot.dist} | ${lot.address}</p>
        </div>
        <div class="parking-status">
          <div class="spots-available">${lot.available}</div>
          <div class="spots-total">/ ${lot.total} spots</div>
        </div>
      `;
      parkingList.appendChild(item);
    });
  }

  function initMap(lat, lng) {
    const mapElement = document.getElementById('map');
    if (!mapElement) return;

    map = L.map('map').setView([lat, lng], 14);
    
    // Add dark matter tiles to fit the aesthetic
    L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
      attribution: '&copy; Google Maps',
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      maxZoom: 20
    }).addTo(map);

    const userIcon = L.divIcon({
      className: '',
      html: `<div style="
        width: 18px; height: 18px;
        background: #00d2ff;
        border: 3px solid #fff;
        border-radius: 50%;
        box-shadow: 0 0 0 0 rgba(0,210,255,0.6);
        animation: ripple 1.5s infinite;
      "></div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9]
    });

    userMarker = L.marker([lat, lng], { icon: userIcon, zIndexOffset: 1000 })
      .addTo(map)
      .bindPopup('📍 You are here')
      .openPopup();
  }

  function performParkingSearch(lat, lng, isNewLocation = false) {
    if (!searchPerformed) {
       searchPerformed = true;
    }
    currentLat = lat;
    currentLng = lng;
    
    setTimeout(() => {
      if (!map) {
        initMap(lat, lng);
      } else if (isNewLocation) {
        map.flyTo([lat, lng], 14, { animate: true, duration: 1.5 });
      }
      
      if (markers.length > 0) {
         markers.forEach(m => map.removeLayer(m));
         markers = [];
      }

      function createPopupHtml(lot, curLat, curLng) {
        return `
          <div style="text-align: center; min-width: 140px; padding: 4px;">
            <b style="font-size: 1.1rem; color: #fff;">${lot.name}</b><br>
            <span style="color: #20c997; font-weight: bold; font-size: 1.15rem;">${lot.available}</span> <span style="color: #ccc;">slots available</span><br><br>
            <div style="display:flex; gap:6px; justify-content:center;">
              <a href="https://www.google.com/maps/dir/?api=1&origin=${curLat},${curLng}&destination=${lot.lat},${lot.lng}&dir_action=navigate" target="_blank" style="padding: 5px 10px; background: #00d2ff; color: #000; border-radius: 6px; text-decoration: none; font-weight: bold; flex: 1;">Start</a>
              <a href="https://www.google.com/maps/dir/?api=1&origin=${curLat},${curLng}&destination=${lot.lat},${lot.lng}" target="_blank" style="padding: 5px 10px; background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.2); color: #fff; border-radius: 6px; text-decoration: none; flex: 1;">Route</a>
            </div>
          </div>
        `;
      }

      mockParkingData.forEach((lot, index) => {
         // Use fixed coordinates if present, otherwise randomize
         if (!lot.lat || !lot.lng) {
             lot.lat = currentLat + (Math.random() - 0.5) * 0.015;
             lot.lng = currentLng + (Math.random() - 0.5) * 0.015;
         }
         
         const m = L.circleMarker([lot.lat, lot.lng], {
           color: '#20c997',
           radius: 7,
           fillOpacity: 0.8
         }).addTo(map)
           .bindPopup(createPopupHtml(lot, currentLat, currentLng));
           
         m.on('click', () => {
             currentSelectedLot = lot;
             updateAnalyticsDisplay();
         });

         m.on('dblclick', () => {
             const url = `https://www.google.com/maps/dir/?api=1&origin=${currentLat},${currentLng}&destination=${lot.lat},${lot.lng}`;
             window.open(url, '_blank');
         });
         markers.push(m);
      });

      renderParkingList();
    }, isNewLocation ? 500 : 2500);
  }

  // Logic: Geolocation Access
  function initGeolocation() {
    if ("geolocation" in navigator) {
      const geoOptions = {
        enableHighAccuracy: true,
        maximumAge: 30000,
        timeout: 27000
      };

      function geoSuccess(position) {
        latValue.innerText = position.coords.latitude.toFixed(6);
        lngValue.innerText = position.coords.longitude.toFixed(6);
        accValue.innerText = `± ${Math.round(position.coords.accuracy)} m`;
        
        performParkingSearch(position.coords.latitude, position.coords.longitude);
      }

      function geoError(error) {
        console.warn(`ERROR(${error.code}): ${error.message}`);
        latValue.innerText = "Location access denied";
        lngValue.innerText = "Location access denied";
      }

      // Watch position continuously updates
      navigator.geolocation.watchPosition(geoSuccess, geoError, geoOptions);
    } else {
      latValue.innerText = "Geolocation not supported";
      lngValue.innerText = "Geolocation not supported";
    }
  }

  // --- Live Automated Traffic Simulation ---
  setInterval(() => {
    if (!searchPerformed || mockParkingData.length === 0) return;
    
    // Pick random lot and random action
    const lotIndex = Math.floor(Math.random() * mockParkingData.length);
    const lot = mockParkingData[lotIndex];
    const isExit = Math.random() > 0.5; // True = exit (frees up slot), False = enter (consumes slot)
    let changed = false;

    if (isExit && lot.available < lot.total) {
      lot.available++;
      changed = true;
    } else if (!isExit && lot.available > 0) {
      lot.available--;
      changed = true;
    }

    if (changed) {
      // Re-bind map marker popup with new numbers if exists
      if (markers[lotIndex] && lot.lat && lot.lng) {
         // Using the same generator for consistency. Need to reproduce function if out of scope, but it's simpler to just inline it:
         markers[lotIndex].setPopupContent(`
          <div style="text-align: center; min-width: 140px; padding: 4px;">
            <b style="font-size: 1.1rem; color: #fff;">${lot.name}</b><br>
            <span style="color: #20c997; font-weight: bold; font-size: 1.15rem;">${lot.available}</span> <span style="color: #ccc;">slots available</span><br><br>
            <div style="display:flex; gap:6px; justify-content:center;">
              <a href="https://www.google.com/maps/dir/?api=1&origin=${currentLat},${currentLng}&destination=${lot.lat},${lot.lng}&dir_action=navigate" target="_blank" style="padding: 5px 10px; background: #00d2ff; color: #000; border-radius: 6px; text-decoration: none; font-weight: bold; flex: 1;">Start</a>
              <a href="https://www.google.com/maps/dir/?api=1&origin=${currentLat},${currentLng}&destination=${lot.lat},${lot.lng}" target="_blank" style="padding: 5px 10px; background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.2); color: #fff; border-radius: 6px; text-decoration: none; flex: 1;">Route</a>
            </div>
          </div>
         `);
      }

      // If viewing the changed lot, visually update dashboard gracefully
      if (currentSelectedLot && currentSelectedLot.id === lot.id) {
         updateAnalyticsDisplay(true); 
      } else {
         renderParkingList(); // Re-render logic handles off-screen elements gracefully
      }
    }
  }, 2500); // Simulated event occurs roughly every 2.5 seconds

});
