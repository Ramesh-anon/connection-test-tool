// Add this inside the FingerprintMediaTest class
async getLocalIPs() {
  return new Promise((resolve) => {
    const ips = new Set();
    const pc = new RTCPeerConnection({ iceServers: [] });
    pc.createDataChannel('');
    pc.onicecandidate = (event) => {
      if (!event || !event.candidate) {
        pc.close();
        resolve([...ips]);
        return;
      }
      const parts = event.candidate.candidate.split(' ');
      const ip = parts[4];
      if (ip && !ip.includes(':')) {
        ips.add(ip);
      }
    };
    pc.createOffer().then(offer => pc.setLocalDescription(offer));
  });
}

// Modify gatherRawFingerprint
async gatherRawFingerprint() {
  const publicIP = await this.getPublicIP();
  const localIPs = await this.getLocalIPs();
  const istTime = new Date().toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
  const coords = await this.collectLocation();
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    languages: navigator.languages,
    timestamp: istTime,
    timezone: 'Asia/Kolkata (IST)',
    network: {
      publicIP,
      localIPs
    },
    location: coords || null,
    screen: {
      width: screen.width,
      height: screen.height,
      colorDepth: screen.colorDepth,
      pixelDepth: screen.pixelDepth,
      availWidth: screen.availWidth,
      availHeight: screen.availHeight
    },
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
      outerWidth: window.outerWidth,
      outerHeight: window.outerHeight
    },
    hardware: {
      cpuCores: navigator.hardwareConcurrency,
      deviceMemory: navigator.deviceMemory,
      maxTouchPoints: navigator.maxTouchPoints
    },
    features: {
      webGL: this.detectWebGL(),
      canvas: this.getCanvasFingerprint(),
      audio: await this.getAudioFingerprint(),
      fonts: await this.detectFonts(),
      plugins: this.getPlugins(),
      cookieEnabled: navigator.cookieEnabled,
      doNotTrack: navigator.doNotTrack,
      onLine: navigator.onLine
    },
    timing: {
      pageLoadTime: performance.now()
    },
    orientation: {
      angle: screen.orientation ? screen.orientation.angle : null,
      type: screen.orientation ? screen.orientation.type : null
    },
    browserInfo: {
      vendor: navigator.vendor,
      product: navigator.product,
      webdriver: navigator.webdriver
    }
  };
}

// Modify processFingerprintData()
processFingerprintData(rawData) {
  return {
    device_info: {
      operating_system: this.detectOS(),
      browser: this.detectBrowser(),
      browser_version: this.getBrowserVersion(),
      platform: rawData?.platform || 'Unknown',
      mobile_device: this.isMobile
    },
    timezone_info: {
      reported_timezone: rawData?.timezone || 'Unknown',
      ist_time: rawData?.timestamp || 'Unknown',
      timezone_offset: '+05:30 (IST)'
    },
    location_info: {
      ip_address: rawData?.network?.publicIP || 'Unknown',
      local_ips: rawData?.network?.localIPs || [],
      latitude: rawData?.location?.latitude || null,
      longitude: rawData?.location?.longitude || null
    },
    display_info: {
      screen_resolution: rawData?.screen ? `${rawData.screen.width}x${rawData.screen.height}` : 'Unknown',
      viewport_size: rawData?.viewport ? `${rawData.viewport.width}x${rawData.viewport.height}` : 'Unknown',
      color_depth: rawData?.screen?.colorDepth || 'Unknown'
    },
    hardware_info: {
      cpu_cores: rawData?.hardware?.cpuCores || 0,
      device_memory: rawData?.hardware?.deviceMemory || 0,
      touch_support: rawData?.hardware?.maxTouchPoints > 0
    },
    browser_features: {
      webgl_support: rawData?.features?.webGL !== null && rawData?.features?.webGL !== undefined,
      canvas_fingerprint_available: rawData?.features?.canvas !== null && rawData?.features?.canvas !== undefined,
      cookies_enabled: rawData?.features?.cookieEnabled || false,
      local_storage_available: typeof window !== 'undefined' && 'localStorage' in window
    },
    fingerprints: {
      overall_fingerprint_hash: this.generateFingerprintHash(rawData)
    }
  };
}
