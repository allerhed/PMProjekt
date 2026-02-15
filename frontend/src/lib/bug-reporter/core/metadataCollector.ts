import type { BrowserMetadata } from './types';

function detectBrowser(ua: string): string {
  if (ua.includes('Firefox/')) return 'Firefox';
  if (ua.includes('Edg/')) return 'Edge';
  if (ua.includes('OPR/') || ua.includes('Opera/')) return 'Opera';
  if (ua.includes('Chrome/') && !ua.includes('Edg/')) return 'Chrome';
  if (ua.includes('Safari/') && !ua.includes('Chrome/')) return 'Safari';
  return 'Unknown';
}

function detectOS(ua: string): string {
  if (ua.includes('Windows')) return 'Windows';
  if (ua.includes('Mac OS X') || ua.includes('Macintosh')) return 'macOS';
  if (ua.includes('CrOS')) return 'Chrome OS';
  if (ua.includes('Android')) return 'Android';
  if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
  if (ua.includes('Linux')) return 'Linux';
  return 'Unknown';
}

export function collectMetadata(): BrowserMetadata {
  const ua = navigator.userAgent;
  return {
    browser: detectBrowser(ua),
    os: detectOS(ua),
    url: window.location.href,
    screenSize: {
      width: window.screen.width,
      height: window.screen.height,
    },
    viewportSize: {
      width: window.innerWidth,
      height: window.innerHeight,
    },
    userAgent: ua,
    language: navigator.language,
    timestamp: new Date().toISOString(),
    touchSupport: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
  };
}
