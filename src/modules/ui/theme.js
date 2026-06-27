// Theme handling: light / dark / dynamic (sunrise/sunset based on GPS)
// Uses a single `data-theme` attribute on <html> so CSS variables can swap.

let timerId = null;
let currentMode = 'light'; // 'light', 'dark', or 'dynamic'

// ---------------------------------------------------------------------------
// Simplified NOAA sunrise/sunset calculation (client-side, no external API)
// Returns { sunrise, sunset } in hours (decimal, local time)
// ---------------------------------------------------------------------------
function calcSunriseSunset(lat, lng, date) {
  const zenith = 90.833;
  const D2R = Math.PI / 180;
  const R2D = 180 / Math.PI;

  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();

  // Julian day
  const julDay = Math.floor(367 * y - Math.floor(7 * (y + Math.floor((m + 9) / 12)) / 4) + Math.floor(275 * m / 9) + d - 730531.5);
  const julCent = (julDay - 2451545) / 36525;

  const geomMeanLong = (280.46646 + julCent * (36000.76983 + julCent * 0.0003032)) % 360;
  const geomMeanAnom = 357.52911 + julCent * (35999.05029 - 0.0001537 * julCent);
  const eccent = 0.016708634 - julCent * (0.000042037 + 0.0000001267 * julCent);
  const sunEq = Math.sin(geomMeanAnom * D2R) * (1.914602 - julCent * (0.004817 + 0.000014 * julCent))
    + Math.sin(2 * geomMeanAnom * D2R) * (0.019993 - 0.000101 * julCent)
    + Math.sin(3 * geomMeanAnom * D2R) * 0.000289;

  const sunTrueLong = geomMeanLong + sunEq;
  const sunAppLong = sunTrueLong - 0.00569 - 0.00478 * Math.sin(D2R * (125.04 - 1934.136 * julCent));

  const meanObliq = 23 + (26 + (21.448 - julCent * (46.815 + julCent * (0.00059 - julCent * 0.001813))) / 60) / 60;
  const obliqCorr = meanObliq + 0.00256 * Math.cos(D2R * (125.04 - 1934.136 * julCent));

  const declination = R2D * Math.asin(Math.sin(obliqCorr * D2R) * Math.sin(sunAppLong * D2R));

  const varY = Math.tan(obliqCorr / 2 * D2R) * Math.tan(obliqCorr / 2 * D2R);
  const eqOfTime = 4 * R2D * (
    varY * Math.sin(2 * geomMeanLong * D2R)
    - 2 * eccent * Math.sin(geomMeanAnom * D2R)
    + 4 * eccent * varY * Math.sin(geomMeanAnom * D2R) * Math.cos(2 * geomMeanLong * D2R)
    - 0.5 * varY * varY * Math.sin(4 * geomMeanLong * D2R)
    - 1.25 * eccent * eccent * Math.sin(2 * geomMeanAnom * D2R)
  );

  // Hour angle
  let ha = Math.acos(
    Math.cos(zenith * D2R) / (Math.cos(lat * D2R) * Math.cos(declination * D2R))
    - Math.tan(lat * D2R) * Math.tan(declination * D2R)
  );
  ha = R2D * ha;

  // Sunrise/Sunset in minutes from midnight GMT
  const sunriseMin = 720 - 4 * (lng + ha) - eqOfTime;
  const sunsetMin  = 720 - 4 * (lng - ha) - eqOfTime;

  // Convert to local decimal hours
  const tzOff = date.getTimezoneOffset();
  const sunrise = (sunriseMin - tzOff) / 60;
  const sunset  = (sunsetMin  - tzOff) / 60;

  return { sunrise, sunset };
}

// ---------------------------------------------------------------------------
// Determine if it's currently day or night based on sunrise/sunset
// ---------------------------------------------------------------------------
function isDaytime(lat, lng) {
  const now = new Date();
  const { sunrise, sunset } = calcSunriseSunset(lat, lng, now);
  const currentHour = now.getHours() + now.getMinutes() / 60;
  return currentHour >= sunrise && currentHour < sunset;
}

// ---------------------------------------------------------------------------
// Apply the correct theme for the current mode
// ---------------------------------------------------------------------------
function setTheme(t) {
  document.documentElement.dataset.theme = t;
}

function applyDynamicTheme(lat, lng) {
  const day = isDaytime(lat, lng);
  setTheme(day ? 'light' : 'dark');
}

// ---------------------------------------------------------------------------
// Start/stop the dynamic theme timer (checks every 60 seconds)
// ---------------------------------------------------------------------------
let dynamicLat = null;
let dynamicLng = null;

function startDynamicTimer(lat, lng) {
  dynamicLat = lat;
  dynamicLng = lng;
  stopDynamicTimer();
  applyDynamicTheme(lat, lng);
  timerId = setInterval(() => applyDynamicTheme(lat, lng), 60000);
}

function stopDynamicTimer() {
  if (timerId !== null) {
    clearInterval(timerId);
    timerId = null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export function applyTheme(theme, lat, lng) {
  currentMode = theme;

  if (theme === 'dynamic') {
    if (lat != null && lng != null) {
      startDynamicTimer(lat, lng);
      return;
    }
    // Fallback: no location available → use simple time heuristic
    const h = new Date().getHours();
    setTheme(h >= 7 && h < 19 ? 'light' : 'dark');
    return;
  }

  // Light or dark — stop timer
  stopDynamicTimer();
  setTheme(theme === 'light' ? 'light' : 'dark');
}

export function applyPalette(palette) {
  const p = palette || 'default';
  document.documentElement.dataset.palette = p;
}

export { stopDynamicTimer as stopDynamicTheme };
