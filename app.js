/* PasaheCheck: client-side, no account or location-upload API. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const formatPeso = value => `₱${value.toFixed(2)}`;
  const state = {
    vehicle: 'traditional', mode: 'demo', demoKm: 9, discounted: false,
    gpsDistanceKm: 0, gpsActive: false, gpsWatchId: null,
    lastGpsPoint: null, acceptedPoints: [], map: null,
    ridePath: null, startMarker: null, currentMarker: null, endMarker: null
  };

  function distanceKm() { return state.mode === 'demo' ? state.demoKm : state.gpsDistanceKm; }
  function currentFare() { return window.PasaheCheckFare.calculateFare(distanceKm(), state.vehicle, state.discounted); }
  function paintFare() {
    const f = currentFare();
    const [whole, cents] = f.total.toFixed(2).split('.');
    $('fareDisplay').innerHTML = `₱${whole}<span>.${cents}</span>`;
    $('fareSubtitle').textContent = `${state.discounted ? '20% discounted' : 'Regular'} fare • ${f.rate.label}`;
    $('baseDisplay').textContent = formatPeso(f.baseFare);
    $('extraDisplay').textContent = formatPeso(f.extraFare);
    $('discountDisplay').textContent = `−${formatPeso(f.discountUnrounded)}`;
    $('totalDisplay').textContent = formatPeso(f.total);
    $('distanceDisplay').innerHTML = `${f.distanceKm.toFixed(2)} <span>km</span>`;
    $('additionalDisplay').innerHTML = `${f.extraKm.toFixed(2)} <span>km</span>`;
    paintComparison(f.total);
  }
  function paintComparison(estimatedFare) {
    const entered = $('chargedAmount').value.trim();
    const box = $('comparisonResult');
    const symbol = box.querySelector('.comparison-symbol');
    const title = box.querySelector('strong');
    const description = box.querySelector('small');
    box.className = 'comparison-result neutral';
    if (entered === '' || !Number.isFinite(Number(entered)) || Number(entered) < 0) {
      symbol.textContent = '↔'; title.textContent = 'Ready to compare';
      description.textContent = 'Enter the fare you were charged to check the difference.';
      return;
    }
    const diff = Number(entered) - estimatedFare;
    if (diff > 0.005) {
      box.classList.add('high'); symbol.textContent = '!';
      title.textContent = `${formatPeso(diff)} above the estimate`;
      description.textContent = 'Possible discrepancy. Please verify against the posted official fare matrix.';
    } else if (diff < -0.005) {
      box.classList.add('low'); symbol.textContent = '✓';
      title.textContent = `${formatPeso(-diff)} below the estimate`;
      description.textContent = 'The charged amount is below this prototype estimate.';
    } else {
      box.classList.add('low'); symbol.textContent = '✓';
      title.textContent = 'Matches the estimate';
      description.textContent = 'The charged amount matches this prototype calculation.';
    }
  }
  function setMode(nextMode) {
    if (nextMode === state.mode) return;
    if (state.gpsActive) endGpsRide();
    state.mode = nextMode;
    $('demoModeBtn').classList.toggle('selected', nextMode === 'demo');
    $('gpsModeBtn').classList.toggle('selected', nextMode === 'gps');
    $('demoModeBtn').setAttribute('aria-pressed', String(nextMode === 'demo'));
    $('gpsModeBtn').setAttribute('aria-pressed', String(nextMode === 'gps'));
    $('demoControls').hidden = nextMode !== 'demo';
    $('gpsControls').hidden = nextMode !== 'gps';
    $('mapBadge').textContent = nextMode === 'demo' ? 'DEMO MODE' : 'LIVE GPS MODE';
    $('mapBadge').classList.toggle('live', nextMode === 'gps');
    $('mapFloatingText').textContent = nextMode === 'demo' ? 'Map centered on Cebu City' : 'GPS starts when you tap Start Ride';
    paintFare();
    if (state.map) setTimeout(() => state.map.invalidateSize(), 150);
  }
  function updateGpsStatus(message) { $('gpsStatusText').textContent = message; }

  function haversineMeters(a, b) {
    const toRadians = deg => deg * Math.PI / 180;
    const r = 6371000;
    const dLat = toRadians(b.lat - a.lat);
    const dLon = toRadians(b.lng - a.lng);
    const y = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLon / 2) ** 2;
    return 2 * r * Math.asin(Math.min(1, Math.sqrt(y)));
  }
  function clearRideVisuals() {
    if (!state.map) return;
    for (const layer of [state.ridePath, state.startMarker, state.currentMarker, state.endMarker]) {
      if (layer) state.map.removeLayer(layer);
    }
    state.ridePath = state.startMarker = state.currentMarker = state.endMarker = null;
  }
  function paintMapPoint(point) {
    if (!state.map || !window.L) return;
    const ll = [point.lat, point.lng];
    if (!state.startMarker) {
      state.startMarker = L.circleMarker(ll, {radius: 7, color: '#ffffff', weight: 3, fillColor: '#0f8d69', fillOpacity: 1}).addTo(state.map).bindPopup('Ride started here');
      state.ridePath = L.polyline([ll], {color: '#0f8d69', weight: 5, opacity: .9}).addTo(state.map);
      state.currentMarker = L.circleMarker(ll, {radius: 8, color: '#ffffff', weight: 3, fillColor: '#1d8fea', fillOpacity: 1}).addTo(state.map).bindPopup('Current location');
      state.map.setView(ll, 16);
    } else {
      state.ridePath.addLatLng(ll);
      state.currentMarker.setLatLng(ll);
      state.map.panTo(ll, {animate: true, duration: .4});
    }
  }
  function onGpsUpdate(position) {
    if (!state.gpsActive) return;
    const {latitude, longitude, accuracy} = position.coords;
    const timestamp = position.timestamp;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
    $('accuracyDisplay').textContent = `${Math.round(accuracy)} m`;
    // Coarse GPS fixes produce large false distances: omit them.
    if (!Number.isFinite(accuracy) || accuracy > 50) {
      updateGpsStatus(`Weak GPS accuracy (±${Math.round(accuracy)} m). Move to an open area.`);
      return;
    }
    const point = {lat: latitude, lng: longitude, accuracy, timestamp};
    const last = state.lastGpsPoint;
    if (last) {
      const segmentMeters = haversineMeters(last, point);
      const elapsedSeconds = (timestamp - last.timestamp) / 1000;
      // Basic protection against GPS jumps and stationary jitter; not map matching.
      if (elapsedSeconds <= 0 || segmentMeters < 12 || segmentMeters / elapsedSeconds > 35) return;
      state.gpsDistanceKm += segmentMeters / 1000;
    }
    state.lastGpsPoint = point;
    state.acceptedPoints.push(point);
    $('pointsDisplay').textContent = String(state.acceptedPoints.length);
    updateGpsStatus(`GPS tracking • ${state.acceptedPoints.length} accepted positions`);
    $('mapFloatingText').textContent = 'Tracking your approximate phone path';
    paintMapPoint(point);
    paintFare();
  }
  function onGpsError(error) {
    if (!state.gpsActive) return;
    if (error.code === 1) {
      updateGpsStatus('Location denied. Allow location access for this website in your browser.');
      endGpsRide(false);
    } else if (error.code === 2) {
      updateGpsStatus('Position unavailable. Check your device location settings.');
    } else {
      updateGpsStatus('Waiting for GPS signal. Move to an open area and check location settings.');
    }
  }
  function startGpsRide() {
    if (state.gpsActive) return;
    if (!window.isSecureContext) {
      updateGpsStatus('GPS needs HTTPS or localhost. Publish with GitHub Pages, or run locally using localhost.');
      return;
    }
    if (!navigator.geolocation) {
      updateGpsStatus('This browser does not support GPS geolocation.');
      return;
    }
    state.gpsDistanceKm = 0;
    state.lastGpsPoint = null;
    state.acceptedPoints = [];
    $('accuracyDisplay').textContent = '—'; $('pointsDisplay').textContent = '0';
    clearRideVisuals();
    state.gpsActive = true;
    $('startRideBtn').disabled = true;
    $('endRideBtn').disabled = false;
    updateGpsStatus('Requesting location permission and waiting for GPS…');
    try {
      state.gpsWatchId = navigator.geolocation.watchPosition(onGpsUpdate, onGpsError, {
        enableHighAccuracy: true, maximumAge: 0, timeout: 20000
      });
    } catch (error) {
      endGpsRide(false);
      updateGpsStatus(`Cannot start GPS: ${error.message}`);
    }
    paintFare();
  }
  function endGpsRide(updateMessage = true) {
    if (state.gpsWatchId !== null && navigator.geolocation) navigator.geolocation.clearWatch(state.gpsWatchId);
    state.gpsWatchId = null;
    state.gpsActive = false;
    $('startRideBtn').disabled = false;
    $('endRideBtn').disabled = true;
    if (updateMessage) updateGpsStatus(state.acceptedPoints.length ? `Ride ended • ${state.gpsDistanceKm.toFixed(2)} km estimated` : 'Ride ended • No accurate GPS points recorded');
    if (state.map && window.L && state.lastGpsPoint) {
      const ll = [state.lastGpsPoint.lat, state.lastGpsPoint.lng];
      state.endMarker = L.circleMarker(ll, {radius: 5, color: '#ffffff', weight: 2, fillColor: '#f6a449', fillOpacity: 1}).addTo(state.map).bindPopup('Ride ended here');
      if (state.ridePath && state.acceptedPoints.length > 1) state.map.fitBounds(state.ridePath.getBounds(), {padding: [45,45], maxZoom: 16});
    }
    paintFare();
  }
  function initMap() {
    if (!window.L) { $('mapFallback').hidden = false; return; }
    try {
      const map = L.map('map', {zoomControl: false}).setView([10.3157, 123.8854], 13);
      L.control.zoom({position: 'topright'}).addTo(map);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'
      }).addTo(map);
      state.map = map;
      setTimeout(() => map.invalidateSize(), 180);
    } catch (error) {
      $('mapFallback').hidden = false;
      console.warn('Map could not load:', error);
    }
  }
  function setup() {
    document.querySelectorAll('[data-vehicle]').forEach(button => {
      button.addEventListener('click', () => {
        state.vehicle = button.dataset.vehicle;
        document.querySelectorAll('[data-vehicle]').forEach(option => {
          const selected = option === button;
          option.classList.toggle('active', selected);
          option.setAttribute('aria-pressed', String(selected));
        });
        paintFare();
      });
    });
    $('demoModeBtn').addEventListener('click', () => setMode('demo'));
    $('gpsModeBtn').addEventListener('click', () => setMode('gps'));
    $('demoKm').addEventListener('input', event => {
      state.demoKm = Number(event.target.value);
      $('demoKmDisplay').textContent = `${state.demoKm.toFixed(1)} km`;
      paintFare();
    });
    $('discountCheck').addEventListener('change', event => { state.discounted = event.target.checked; paintFare(); });
    $('chargedAmount').addEventListener('input', paintFare);
    $('startRideBtn').addEventListener('click', startGpsRide);
    $('endRideBtn').addEventListener('click', () => endGpsRide());
    window.addEventListener('pagehide', () => {
      if (state.gpsWatchId !== null && navigator.geolocation) navigator.geolocation.clearWatch(state.gpsWatchId);
    });
    initMap();
    paintFare();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup);
  else setup();
})();
