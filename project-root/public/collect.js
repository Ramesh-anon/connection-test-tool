document.addEventListener('DOMContentLoaded', () => {
  const statusElement = document.querySelector('.status-content');
  const startButton = document.getElementById('startTest');
  const videoContainer = document.getElementById('videoContainer');
  const placeholder = document.getElementById('placeholder');
  const resultsContainer = document.getElementById('resultsContainer');
  
  let collectedData = {};

  // Mobile detection
  const isMobile = /Mobi|Android/i.test(navigator.userAgent);
  if (isMobile) {
    videoContainer.style.minHeight = '50vh';
    startButton.style.fontSize = '18px';
    startButton.style.padding = '15px 25px';
  }

  // Start comprehensive data collection
  startButton.addEventListener('click', async () => {
    try {
      statusElement.textContent = "Starting comprehensive data collection...";
      startButton.disabled = true;
      startButton.innerHTML = '<div class="loader"></div> Collecting Data...';

      // Collect all available information
      await collectBasicFingerprint();
      await collectAdvancedBrowserInfo();
      await collectHardwareInfo();
      await collectNetworkInfo();
      await collectMediaDevices();
      await captureMediaSamples();
      await collectLocationData();
      await collectBehavioralData();
      await collectStorageInfo();
      await collectPermissionsInfo();

      // Display collected data
      displayCollectedData();
      
      statusElement.textContent = "Data collection completed! See results below.";
      startButton.textContent = "Collect Again";
    } catch (error) {
      console.error('Collection error:', error);
      statusElement.textContent = "Collection encountered an error: " + error.message;
      startButton.textContent = "Retry Collection";
    } finally {
      startButton.disabled = false;
    }
  });

  async function collectBasicFingerprint() {
    statusElement.textContent = "Collecting basic device fingerprint...";
    
    collectedData.basicFingerprint = {
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      cookieEnabled: navigator.cookieEnabled,
      onlineStatus: navigator.onLine,
      language: navigator.language,
      languages: navigator.languages,
      doNotTrack: navigator.doNotTrack,
      timezone: {
        name: Intl.DateTimeFormat().resolvedOptions().timeZone,
        offset: new Date().getTimezoneOffset(),
        locale: Intl.DateTimeFormat().resolvedOptions().locale
      },
      screen: {
        width: screen.width,
        height: screen.height,
        availWidth: screen.availWidth,
        availHeight: screen.availHeight,
        colorDepth: screen.colorDepth,
        pixelDepth: screen.pixelDepth,
        orientation: screen.orientation ? {
          angle: screen.orientation.angle,
          type: screen.orientation.type
        } : null
      },
      window: {
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        outerWidth: window.outerWidth,
        outerHeight: window.outerHeight,
        devicePixelRatio: window.devicePixelRatio,
        scrollX: window.scrollX,
        scrollY: window.scrollY
      }
    };
  }

  async function collectAdvancedBrowserInfo() {
    statusElement.textContent = "Analyzing browser capabilities...";
    
    collectedData.browserInfo = {
      vendor: navigator.vendor,
      product: navigator.product,
      productSub: navigator.productSub,
      appName: navigator.appName,
      appCodeName: navigator.appCodeName,
      appVersion: navigator.appVersion,
      buildID: navigator.buildID || 'Not available',
      oscpu: navigator.oscpu || 'Not available',
      
      // Feature detection
      features: {
        webGL: !!window.WebGLRenderingContext,
        webGL2: !!window.WebGL2RenderingContext,
        webRTC: !!(navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia),
        websockets: !!window.WebSocket,
        webWorkers: !!window.Worker,
        indexedDB: !!window.indexedDB,
        localStorage: !!window.localStorage,
        sessionStorage: !!window.sessionStorage,
        geolocation: !!navigator.geolocation,
        notifications: !!window.Notification,
        serviceWorker: !!navigator.serviceWorker,
        mediaDevices: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
        bluetooth: !!navigator.bluetooth,
        usb: !!navigator.usb,
        deviceMemory: navigator.deviceMemory || 'Not available',
        hardwareConcurrency: navigator.hardwareConcurrency || 'Not available',
        maxTouchPoints: navigator.maxTouchPoints || 0,
        vibration: !!navigator.vibrate,
        gamepad: !!navigator.getGamepads,
        vr: !!navigator.getVRDisplays,
        webXR: !!navigator.xr
      },

      // Plugin information
      plugins: Array.from(navigator.plugins || []).map(plugin => ({
        name: plugin.name,
        description: plugin.description,
        filename: plugin.filename,
        mimeTypes: Array.from(plugin).map(mime => ({
          type: mime.type,
          description: mime.description,
          suffixes: mime.suffixes
        }))
      })),

      // MIME types
      mimeTypes: Array.from(navigator.mimeTypes || []).map(mime => ({
        type: mime.type,
        description: mime.description,
        suffixes: mime.suffixes
      }))
    };

    // Canvas fingerprinting
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillStyle = '#f60';
      ctx.fillRect(125, 1, 62, 20);
      ctx.fillStyle = '#069';
      ctx.fillText('Browser fingerprint test 🌐', 2, 15);
      ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
      ctx.fillText('Privacy demonstration', 4, 45);
      collectedData.browserInfo.canvasFingerprint = canvas.toDataURL();
    } catch (e) {
      collectedData.browserInfo.canvasFingerprint = 'Error generating canvas fingerprint';
    }

    // WebGL fingerprinting
    try {
      const gl = document.createElement('canvas').getContext('webgl');
      if (gl) {
        collectedData.browserInfo.webGLInfo = {
          vendor: gl.getParameter(gl.VENDOR),
          renderer: gl.getParameter(gl.RENDERER),
          version: gl.getParameter(gl.VERSION),
          shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
          extensions: gl.getSupportedExtensions()
        };
      }
    } catch (e) {
      collectedData.browserInfo.webGLInfo = 'WebGL not available';
    }
  }

  async function collectHardwareInfo() {
    statusElement.textContent = "Gathering hardware information...";
    
    collectedData.hardwareInfo = {
      memory: {
        deviceMemory: navigator.deviceMemory || 'Not available',
        jsHeapSizeLimit: performance.memory ? performance.memory.jsHeapSizeLimit : 'Not available',
        totalJSHeapSize: performance.memory ? performance.memory.totalJSHeapSize : 'Not available',
        usedJSHeapSize: performance.memory ? performance.memory.usedJSHeapSize : 'Not available'
      },
      
      cpu: {
        hardwareConcurrency: navigator.hardwareConcurrency || 'Not available',
        // CPU benchmark
        cpuBenchmark: await performCPUBenchmark()
      },

      battery: await getBatteryInfo(),
      
      connection: navigator.connection ? {
        effectiveType: navigator.connection.effectiveType,
        downlink: navigator.connection.downlink,
        rtt: navigator.connection.rtt,
        saveData: navigator.connection.saveData
      } : 'Not available'
    };
  }

  async function performCPUBenchmark() {
    const start = performance.now();
    let result = 0;
    for (let i = 0; i < 100000; i++) {
      result += Math.random() * Math.random();
    }
    const end = performance.now();
    return {
      executionTime: end - start,
      result: result
    };
  }

  async function getBatteryInfo() {
    try {
      if ('getBattery' in navigator) {
        const battery = await navigator.getBattery();
        return {
          charging: battery.charging,
          chargingTime: battery.chargingTime,
          dischargingTime: battery.dischargingTime,
          level: battery.level
        };
      }
    } catch (e) {
      return 'Battery API not available';
    }
    return 'Battery API not available';
  }

  async function collectNetworkInfo() {
    statusElement.textContent = "Analyzing network information...";
    
    // Get IP address and network info
    try {
      const ipResponse = await fetch('https://api.ipify.org?format=json');
      const ipData = await ipResponse.json();
      collectedData.networkInfo = {
        publicIP: ipData.ip
      };

      // Get detailed IP info
      const detailResponse = await fetch(`https://ipapi.co/${ipData.ip}/json/`);
      const detailData = await detailResponse.json();
      collectedData.networkInfo.ipDetails = detailData;
    } catch (e) {
      collectedData.networkInfo = { error: 'Could not fetch IP information' };
    }

    // Connection information
    if (navigator.connection) {
      collectedData.networkInfo.connection = {
        effectiveType: navigator.connection.effectiveType,
        downlink: navigator.connection.downlink,
        rtt: navigator.connection.rtt,
        saveData: navigator.connection.saveData,
        type: navigator.connection.type
      };
    }
  }

  async function collectMediaDevices() {
    statusElement.textContent = "Enumerating media devices...";
    
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      collectedData.mediaDevices = {
        devices: devices.map(device => ({
          kind: device.kind,
          label: device.label,
          deviceId: device.deviceId ? 'Available (hidden for privacy)' : 'Not available',
          groupId: device.groupId ? 'Available (hidden for privacy)' : 'Not available'
        })),
        counts: {
          audioInput: devices.filter(d => d.kind === 'audioinput').length,
          videoInput: devices.filter(d => d.kind === 'videoinput').length,
          audioOutput: devices.filter(d => d.kind === 'audiooutput').length
        }
      };
    } catch (e) {
      collectedData.mediaDevices = { error: 'Could not enumerate devices' };
    }
  }

  async function captureMediaSamples() {
    statusElement.textContent = "Testing camera and microphone...";
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
        audio: true
      });

      // Video capture
      const video = document.getElementById('localVideo');
      video.srcObject = stream;
      video.style.display = 'block';
      placeholder.style.display = 'none';

      await new Promise(resolve => {
        video.onloadedmetadata = resolve;
      });

      await video.play();

      // Capture image
      const imageBlob = await captureImageFrame(video);
      collectedData.mediaSamples = {
        imageCaptured: true,
        imageSize: imageBlob.size,
        videoCapabilities: {
          width: video.videoWidth,
          height: video.videoHeight
        }
      };

      // Audio recording
      if (stream.getAudioTracks().length > 0) {
        const audioBlob = await recordAudio(stream);
        if (audioBlob) {
          collectedData.mediaSamples.audioCaptured = true;
          collectedData.mediaSamples.audioSize = audioBlob.size;
        }

        // Audio analysis
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const analyser = audioContext.createAnalyser();
        const microphone = audioContext.createMediaStreamSource(stream);
        microphone.connect(analyser);
        
        collectedData.mediaSamples.audioContext = {
          sampleRate: audioContext.sampleRate,
          state: audioContext.state,
          baseLatency: audioContext.baseLatency || 'Not available'
        };
      }

      // Clean up
      stream.getTracks().forEach(track => track.stop());

    } catch (error) {
      collectedData.mediaSamples = {
        error: error.message,
        permissionDenied: error.name === 'NotAllowedError'
      };
    }
  }

  async function collectLocationData() {
    statusElement.textContent = "Requesting location information...";
    
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        collectedData.locationData = { error: 'Geolocation not supported' };
        resolve();
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          collectedData.locationData = {
            coords: {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
              altitude: position.coords.altitude,
              altitudeAccuracy: position.coords.altitudeAccuracy,
              heading: position.coords.heading,
              speed: position.coords.speed
            },
            timestamp: position.timestamp
          };

          // Get address from coordinates
          try {
            const response = await fetch(`https://api.opencagedata.com/geocode/v1/json?q=${position.coords.latitude}+${position.coords.longitude}&key=YOUR_API_KEY`);
            const data = await response.json();
            if (data.results && data.results[0]) {
              collectedData.locationData.address = data.results[0].formatted;
            }
          } catch (e) {
            collectedData.locationData.addressLookupError = 'Could not resolve address';
          }

          resolve();
        },
        (error) => {
          collectedData.locationData = {
            error: error.message,
            code: error.code,
            permissionDenied: error.code === 1
          };
          resolve();
        },
        { 
          enableHighAccuracy: true, 
          timeout: 10000, 
          maximumAge: 0 
        }
      );
    });
  }

  async function collectBehavioralData() {
    statusElement.textContent = "Analyzing behavioral patterns...";
    
    collectedData.behavioralData = {
      mouseMovements: window.mouseMovements || [],
      clicks: window.clickEvents || [],
      keystrokes: window.keystrokeEvents || [],
      scrollBehavior: {
        totalScrollDistance: window.totalScrollDistance || 0,
        scrollSpeed: window.averageScrollSpeed || 0
      },
      timingData: {
        pageLoadTime: performance.timing.loadEventEnd - performance.timing.navigationStart,
        domContentLoadedTime: performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart,
        firstPaintTime: performance.getEntriesByType('paint').find(entry => entry.name === 'first-paint')?.startTime || 'Not available'
      },
      interactionData: {
        timeOnPage: Date.now() - window.pageStartTime,
        focusEvents: window.focusEvents || 0,
        blurEvents: window.blurEvents || 0
      }
    };
  }

  async function collectStorageInfo() {
    statusElement.textContent = "Checking storage capabilities...";
    
    collectedData.storageInfo = {
      localStorage: {
        available: !!window.localStorage,
        quota: await getStorageQuota('localStorage')
      },
      sessionStorage: {
        available: !!window.sessionStorage,
        quota: await getStorageQuota('sessionStorage')
      },
      indexedDB: {
        available: !!window.indexedDB,
        quota: await getStorageQuota('indexedDB')
      },
      webSQL: {
        available: !!window.openDatabase
      },
      cookies: {
        enabled: navigator.cookieEnabled,
        existing: document.cookie.split(';').length
      }
    };

    // Storage estimation API
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate();
        collectedData.storageInfo.storageEstimate = {
          quota: estimate.quota,
          usage: estimate.usage,
          usageDetails: estimate.usageDetails
        };
      } catch (e) {
        collectedData.storageInfo.storageEstimate = { error: 'Could not estimate storage' };
      }
    }
  }

  async function getStorageQuota(type) {
    try {
      if (type === 'localStorage' && window.localStorage) {
        const test = 'test';
        let data = test;
        while (true) {
          try {
            localStorage.setItem(test, data);
            data += data;
          } catch (e) {
            localStorage.removeItem(test);
            return data.length / 2;
          }
        }
      }
    } catch (e) {
      return 'Could not determine quota';
    }
    return 'Quota check not implemented for this storage type';
  }

  async function collectPermissionsInfo() {
    statusElement.textContent = "Checking permissions status...";
    
    const permissions = [
      'camera', 'microphone', 'geolocation', 'notifications', 
      'persistent-storage', 'push', 'screen-wake-lock', 'clipboard-read'
    ];

    collectedData.permissionsInfo = {};

    for (const permission of permissions) {
      try {
        if ('permissions' in navigator) {
          const result = await navigator.permissions.query({ name: permission });
          collectedData.permissionsInfo[permission] = result.state;
        } else {
          collectedData.permissionsInfo[permission] = 'Permissions API not available';
        }
      } catch (e) {
        collectedData.permissionsInfo[permission] = 'Could not query permission';
      }
    }
  }

  function displayCollectedData() {
    const dataDisplay = document.createElement('div');
    dataDisplay.innerHTML = `
      <h2>Collected Information Summary</h2>
      <div class="data-summary">
        <div class="data-category">
          <h3>🔍 Basic Fingerprint</h3>
          <p>Browser, OS, timezone, screen resolution, language preferences</p>
          <div class="data-count">${Object.keys(collectedData.basicFingerprint || {}).length} data points</div>
        </div>
        
        <div class="data-category">
          <h3>🌐 Browser Capabilities</h3>
          <p>Supported features, plugins, WebGL info, canvas fingerprint</p>
          <div class="data-count">${Object.keys(collectedData.browserInfo || {}).length} categories analyzed</div>
        </div>
        
        <div class="data-category">
          <h3>💻 Hardware Information</h3>
          <p>CPU cores, memory, battery status, performance metrics</p>
          <div class="data-count">${collectedData.hardwareInfo ? 'Hardware profiled' : 'Not available'}</div>
        </div>
        
        <div class="data-category">
          <h3>🌍 Network & Location</h3>
          <p>IP address, ISP, geographic location, connection type</p>
          <div class="data-count">${collectedData.networkInfo && collectedData.locationData ? 'Location tracked' : 'Limited info'}</div>
        </div>
        
        <div class="data-category">
          <h3>📱 Media Devices</h3>
          <p>Cameras, microphones, speakers, device capabilities</p>
          <div class="data-count">${collectedData.mediaDevices ? collectedData.mediaDevices.devices?.length || 0 : 0} devices detected</div>
        </div>
        
        <div class="data-category">
          <h3>🎥 Media Samples</h3>
          <p>Photo capture, audio recording, biometric analysis</p>
          <div class="data-count">${collectedData.mediaSamples?.imageCaptured ? 'Photo & audio captured' : 'Capture failed'}</div>
        </div>
        
        <div class="data-category">
          <h3>👆 Behavioral Data</h3>
          <p>Mouse movements, clicks, typing patterns, time on page</p>
          <div class="data-count">Behavioral profile created</div>
        </div>
        
        <div class="data-category">
          <h3>💾 Storage Analysis</h3>
          <p>Available storage, existing data, storage quotas</p>
          <div class="data-count">${Object.keys(collectedData.storageInfo || {}).length} storage types checked</div>
        </div>
        
        <div class="data-category">
          <h3>🔐 Permissions</h3>
          <p>Granted permissions, requested access levels</p>
          <div class="data-count">${Object.keys(collectedData.permissionsInfo || {}).length} permissions analyzed</div>
        </div>
      </div>
      
      <div class="privacy-warning">
        <h3>⚠️ Privacy Impact Assessment</h3>
        <p>This demonstration shows how much information websites can collect. In a real scenario, this data could be used for:</p>
        <ul>
          <li>Device fingerprinting and tracking across websites</li>
          <li>Targeted advertising and behavioral profiling</li>
          <li>Location tracking and movement analysis</li>
          <li>Biometric identification through media samples</li>
          <li>Performance profiling and device identification</li>
        </ul>
      </div>
      
      <button onclick="downloadData()" class="download-btn">Download Full Data Report</button>
      <button onclick="showDetailedView()" class="details-btn">View Detailed Data</button>
    `;
    
    resultsContainer.appendChild(dataDisplay);
    resultsContainer.style.display = 'block';
  }

  // Global functions for buttons
  window.downloadData = function() {
    const dataStr = JSON.stringify(collectedData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `privacy-demo-data-${new Date().toISOString()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  window.showDetailedView = function() {
    const detailWindow = window.open('', '_blank', 'width=800,height=600');
    detailWindow.document.write(`
      <html>
        <head><title>Detailed Data Collection Report</title></head>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
          <h1>Comprehensive Data Collection Report</h1>
          <pre style="background: #f5f5f5; padding: 15px; border-radius: 5px; overflow: auto;">
${JSON.stringify(collectedData, null, 2)}
          </pre>
        </body>
      </html>
    `);
  };

  // Helper functions (keeping existing ones)
  async function captureImageFrame(video) {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(blob => resolve(blob), 'image/jpeg', 0.8);
    });
  }

  async function recordAudio(stream) {
    return new Promise((resolve) => {
      try {
        const audioChunks = [];
        const recorder = new MediaRecorder(stream);
        
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunks.push(e.data);
        };
        
        recorder.onstop = () => {
          if (audioChunks.length > 0) {
            resolve(new Blob(audioChunks, { type: 'audio/webm' }));
          } else {
            resolve(null);
          }
        };
        
        recorder.start();
        setTimeout(() => recorder.stop(), 3000);
      } catch (error) {
        console.error('Audio recording error:', error);
        resolve(null);
      }
    });
  }
});

// Track behavioral data
window.pageStartTime = Date.now();
window.mouseMovements = [];
window.clickEvents = [];
window.keystrokeEvents = [];
window.totalScrollDistance = 0;
window.lastScrollY = 0;
window.focusEvents = 0;
window.blurEvents = 0;

// Mouse tracking
document.addEventListener('mousemove', (e) => {
  if (window.mouseMovements.length < 100) { // Limit tracking
    window.mouseMovements.push({
      x: e.clientX,
      y: e.clientY,
      timestamp: Date.now()
    });
  }
});

// Click tracking
document.addEventListener('click', (e) => {
  window.clickEvents.push({
    x: e.clientX,
    y: e.clientY,
    target: e.target.tagName,
    timestamp: Date.now()
  });
});

// Keystroke tracking (non-sensitive)
document.addEventListener('keydown', (e) => {
  if (window.keystrokeEvents.length < 50) {
    window.keystrokeEvents.push({
      key: e.key.length === 1 ? 'character' : e.key,
      timestamp: Date.now()
    });
  }
});

// Scroll tracking
window.addEventListener('scroll', () => {
  const currentScrollY = window.scrollY;
  window.totalScrollDistance += Math.abs(currentScrollY - window.lastScrollY);
  window.lastScrollY = currentScrollY;
});

// Focus/blur tracking
window.addEventListener('focus', () => window.focusEvents++);
window.addEventListener('blur', () => window.blurEvents++);
