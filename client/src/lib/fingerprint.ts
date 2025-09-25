/**
 * Device Fingerprinting Library
 * Collects various device signals for unique device identification
 * Designed to work across browsers and resist VPN circumvention
 */

interface DeviceFingerprint {
  stableHash: string;
  volatileHash: string;
  chUaHash?: string;
  webglHash?: string;
  canvasHash?: string;
  fontsHash?: string;
  storageFlags?: string;
}

interface DeviceSignals {
  // Stable signals (hardware-based, consistent across browsers)
  webglVendor?: string;
  webglRenderer?: string;
  deviceMemory?: number;
  hardwareConcurrency?: number;
  platform?: string;
  architecture?: string;
  audioFingerprint?: string;
  
  // Medium-weight signals
  userAgent?: string;
  languages?: string[];
  timezone?: number;
  touchPoints?: number;
  colorDepth?: number;
  screenWidth?: number;
  screenHeight?: number;
  pixelRatio?: number;
  
  // Client Hints
  chUa?: string;
  chUaFullVersionList?: string;
  chUaPlatform?: string;
  chUaArch?: string;
  chUaModel?: string;
  
  // Canvas and font fingerprints
  canvasFingerprint?: string;
  fontList?: string[];
}

// Crypto utilities for hashing
async function hashString(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Get WebGL information
function getWebGLInfo(): { vendor?: string; renderer?: string } {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl') as WebGLRenderingContext;
    
    if (!gl) return {};
    
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (!debugInfo) return {};
    
    return {
      vendor: gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL),
      renderer: gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
    };
  } catch {
    return {};
  }
}

// Generate canvas fingerprint
function getCanvasFingerprint(): string {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    
    canvas.width = 200;
    canvas.height = 50;
    
    // Draw some text and shapes for fingerprinting
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('Device fingerprint 🔒', 2, 15);
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.fillText('Device fingerprint 🔒', 4, 17);
    
    return canvas.toDataURL();
  } catch {
    return '';
  }
}

// Generate audio context fingerprint
function getAudioFingerprint(): Promise<string> {
  return new Promise((resolve) => {
    try {
      const context = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = context.createOscillator();
      const analyser = context.createAnalyser();
      const gainNode = context.createGain();
      const scriptProcessor = context.createScriptProcessor(4096, 1, 1);
      
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(10000, context.currentTime);
      
      gainNode.gain.setValueAtTime(0, context.currentTime);
      
      oscillator.connect(analyser);
      analyser.connect(scriptProcessor);
      scriptProcessor.connect(gainNode);
      gainNode.connect(context.destination);
      
      scriptProcessor.onaudioprocess = function(bins) {
        bins.outputBuffer.getChannelData(0);
        const fingerprint = Array.from(bins.inputBuffer.getChannelData(0))
          .slice(0, 50)
          .map(x => Math.round(x * 1000) / 1000)
          .join(',');
        
        context.close();
        resolve(fingerprint);
      };
      
      oscillator.start(0);
      setTimeout(() => {
        try {
          context.close();
          resolve('');
        } catch {}
      }, 100);
    } catch {
      resolve('');
    }
  });
}

// Get available fonts by measuring text rendering
function getFontFingerprint(): string {
  try {
    const testFonts = [
      'Arial', 'Times New Roman', 'Courier New', 'Helvetica', 'Georgia',
      'Verdana', 'Comic Sans MS', 'Trebuchet MS', 'Arial Black', 'Impact',
      'Palatino', 'Garamond', 'Bookman', 'Avant Garde', 'Calibri',
      'Cambria', 'Consolas', 'Candara', 'Franklin Gothic', 'Futura',
      'Geneva', 'Monaco', 'Optima', 'Tahoma', 'Times'
    ];
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    
    const baseline = 'Arial';
    const testString = 'mmmmmmmmmmlli';
    const testSize = '72px';
    
    ctx.font = testSize + ' ' + baseline;
    const baselineWidth = ctx.measureText(testString).width;
    
    const availableFonts: string[] = [];
    
    testFonts.forEach(font => {
      ctx.font = testSize + ' ' + font + ', ' + baseline;
      const width = ctx.measureText(testString).width;
      if (width !== baselineWidth) {
        availableFonts.push(font);
      }
    });
    
    return availableFonts.sort().join(',');
  } catch {
    return '';
  }
}

// Get User-Agent Client Hints
async function getClientHints(): Promise<any> {
  try {
    if (!('userAgentData' in navigator)) {
      return {};
    }
    
    const ua = (navigator as any).userAgentData;
    const highEntropyValues = await ua.getHighEntropyValues([
      'platform',
      'platformVersion', 
      'architecture',
      'model',
      'uaFullVersion',
      'fullVersionList'
    ]);
    
    return {
      brands: ua.brands,
      mobile: ua.mobile,
      ...highEntropyValues
    };
  } catch {
    return {};
  }
}

// Collect all device signals
async function collectDeviceSignals(): Promise<DeviceSignals> {
  const webglInfo = getWebGLInfo();
  const clientHints = await getClientHints();
  const audioFingerprint = await getAudioFingerprint();
  
  return {
    // Stable hardware signals
    webglVendor: webglInfo.vendor,
    webglRenderer: webglInfo.renderer,
    deviceMemory: (navigator as any).deviceMemory,
    hardwareConcurrency: navigator.hardwareConcurrency,
    platform: navigator.platform,
    audioFingerprint,
    
    // Medium-weight signals  
    userAgent: navigator.userAgent,
    languages: navigator.languages ? Array.from(navigator.languages) : [navigator.language],
    timezone: new Date().getTimezoneOffset(),
    touchPoints: navigator.maxTouchPoints,
    colorDepth: screen.colorDepth,
    screenWidth: screen.width,
    screenHeight: screen.height,
    pixelRatio: window.devicePixelRatio,
    
    // Client Hints
    chUa: clientHints.brands?.map((b: any) => `${b.brand}:${b.version}`).join(';'),
    chUaFullVersionList: clientHints.fullVersionList?.map((b: any) => `${b.brand}:${b.version}`).join(';'),
    chUaPlatform: clientHints.platform,
    chUaArch: clientHints.architecture,
    chUaModel: clientHints.model,
    
    // Visual fingerprints
    canvasFingerprint: getCanvasFingerprint(),
    fontList: getFontFingerprint().split(',').filter(f => f)
  };
}

// Generate normalized fingerprint hashes
export async function generateDeviceFingerprint(): Promise<DeviceFingerprint> {
  const signals = await collectDeviceSignals();
  
  // Stable hash (hardware-based signals)
  const stableSignals = [
    signals.webglVendor,
    signals.webglRenderer, 
    signals.deviceMemory,
    signals.hardwareConcurrency,
    signals.platform,
    signals.audioFingerprint
  ].filter(s => s != null).join('|');
  
  const stableHash = await hashString(stableSignals);
  
  // Volatile hash (medium-weight signals)
  const volatileSignals = [
    signals.userAgent,
    signals.languages?.join(','),
    signals.timezone,
    signals.touchPoints,
    signals.colorDepth,
    signals.screenWidth,
    signals.screenHeight,
    signals.pixelRatio
  ].filter(s => s != null).join('|');
  
  const volatileHash = await hashString(volatileSignals);
  
  // Specific component hashes
  const chUaHash = signals.chUa ? await hashString(signals.chUa) : undefined;
  const webglHash = (signals.webglVendor && signals.webglRenderer) 
    ? await hashString(`${signals.webglVendor}|${signals.webglRenderer}`) 
    : undefined;
  const canvasHash = signals.canvasFingerprint 
    ? await hashString(signals.canvasFingerprint) 
    : undefined;
  const fontsHash = signals.fontList?.length 
    ? await hashString(signals.fontList.sort().join(',')) 
    : undefined;
  
  // Storage flags (what storage mechanisms are available)
  const storageFlags = [
    'localStorage' in window ? 'ls' : '',
    'sessionStorage' in window ? 'ss' : '',
    'indexedDB' in window ? 'idb' : '',
    'caches' in window ? 'cache' : ''
  ].filter(f => f).join(',');
  
  return {
    stableHash,
    volatileHash,
    chUaHash,
    webglHash,
    canvasHash,
    fontsHash,
    storageFlags
  };
}

// Generate a unique server device ID and store it persistently
export function getOrCreateServerDeviceId(): string {
  const DEVICE_ID_KEY = 'b2b_device_id';
  
  // Try to get from various storage mechanisms
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  
  if (!deviceId) {
    try {
      deviceId = sessionStorage.getItem(DEVICE_ID_KEY);
    } catch {}
  }
  
  // Generate new device ID if not found
  if (!deviceId) {
    deviceId = 'b2b_' + Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
  
  // Store in multiple locations for persistence
  try {
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  } catch {}
  
  try {
    sessionStorage.setItem(DEVICE_ID_KEY, deviceId);
  } catch {}
  
  // Also store in IndexedDB for cross-browser persistence
  try {
    const request = indexedDB.open('b2b_device', 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('device')) {
        db.createObjectStore('device');
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction(['device'], 'readwrite');
      const store = tx.objectStore('device');
      store.put(deviceId, 'id');
    };
  } catch {}
  
  return deviceId;
}

// Complete device fingerprinting data for API submission
export async function getDeviceFingerprint(): Promise<{
  serverDeviceId: string;
  fingerprints: DeviceFingerprint;
}> {
  const serverDeviceId = getOrCreateServerDeviceId();
  const fingerprints = await generateDeviceFingerprint();
  
  return {
    serverDeviceId,
    fingerprints
  };
}