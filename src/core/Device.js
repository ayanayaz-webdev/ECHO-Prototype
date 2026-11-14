// Decides whether to use touch controls and which graphics settings suit the device.
// For testing on a desktop, add ?touch=1 to the address (and ?touch=0 to force them off).
const params = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams('');
const forced = params.get('touch');

function detectTouch() {
  if (forced === '1') return true;
  if (forced === '0') return false;
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  const coarse = window.matchMedia('(pointer: coarse)').matches;                  // phone or tablet
  const touchOnly = 'ontouchstart' in window && !window.matchMedia('(any-pointer: fine)').matches;
  return coarse || touchOnly;
}

export const isTouch = detectTouch();
export const debugFromUrl = params.get('debug') === '1';

// Phones get a lower starting resolution, no anti-aliasing, fewer real-time lights, and the game
// adjusts its resolution on the fly to hold a steady frame rate.
export const quality = isTouch
  ? { pixelRatioStart: 1.0, pixelRatioMax: 1.5, pixelRatioMin: 0.6, antialias: false, lightPool: 4, anisotropy: 2, adaptive: true }
  : { pixelRatioStart: 1.25, pixelRatioMax: 1.25, pixelRatioMin: 1.25, antialias: true, lightPool: 6, anisotropy: 16, adaptive: false };
