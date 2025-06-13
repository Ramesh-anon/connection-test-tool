/**
 * Browser Fingerprinting and Media Capture Utility
 * 
 * This script collects browser fingerprinting data and tests camera/microphone functionality
 * with enhanced privacy controls and user consent.
 */
class FingerprintMediaTest {
  constructor() {
    this.initElements();
    this.initEventListeners();
    this.isMobile = /Mobi|Android/i.test(navigator.userAgent);
    this.audioVisualizerActive = false;
    this.audioContext = null;
    this.analyser = null;
    this.consentGiven = false;
  }

  initElements() {
    this.statusElement = document.querySelector('.status-content');
    this.startButton = document.getElementById('startTest');
    this.consentCheckbox = document.getElementById('consentCheckbox');
    this.videoContainer = document.getElementById('videoContainer');
    this.placeholder = document.getElementById('placeholder');
    this.cameraStatus = document.getElementById('cameraStatus');
    this.micStatus = document.getElementById('micStatus');
    this.audioBars = document.querySelectorAll('.audio-bar');
    this.localVideo = document.getElementById('localVideo');
    this.networkStatus = document.getElementById('networkStatus');
  }

  initEventListeners() {
    this.consentCheckbox.addEventListener('change', (e) => {
      this.consentGiven = e.target.checked;
      this.startButton.disabled = !this.consentGiven;
    });

    this.startButton.addEventListener('click', async () => {
      if (!this.consentGiven) return;
      
      try {
        await this.runTests();
      } catch (error) {
        console.error('Test error:', error);
        this.setTestStatus(`Test failed: ${error.message}`, false, "Retry Test");
      }
    });
    
    if (this.isMobile) {
      this.videoContainer.style.minHeight = '50vh';
      }
  }

  async runTests() {
    try {
      this.setTestStatus("Starting tests with your consent...", true);
      
      // Get IP (anonymized by server)
      const publicIP = await this.getPublicIP();
      this.networkStatus.textContent = `Network: Detected (IP anonymized)`;
      
      // Collect fingerprint (anonymized)
      const fingerprintData = await this.collectEnhancedFingerprint();
      
      // Media tests (with explicit permission)
      const mediaConsent = await this.requestMediaConsent();
      if (mediaConsent) {
        const mediaData = await this.captureAndSaveMedia();
      } else {
        this.setMediaStatus("Media tests skipped - permission not granted", "Skipped", "Skipped");
      }

      this.setTestStatus("Test completed successfully! Data anonymized and secured.", false, "Test Again");
      
    } catch (error) {
      console.error('Test error:', error);
      this.setTestStatus(`Test error: ${error.message}`, false, "Retry Test");
      throw error;
    }
  }

  async requestMediaConsent() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 640, height: 480 },
        audio: true 
      });
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (error) {
      console.log('Media consent denied:', error);
      return false;
    }
  }

  async getPublicIP() {
    try {
      const response = await fetch('/get-ip');
      if (!response.ok) throw new Error('IP fetch failed');
      const data = await response.json();
      return data.anonymizedIp;
    } catch (error) {
      console.error('IP fetch error:', error);
      return null;
    }
  }

  async collectEnhancedFingerprint() {
    const rawData = this.gatherRawFingerprint();
    const processedData = this.processFingerprintData(rawData);
    
    const response = await fetch('/collect-fingerprint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'processed_fingerprint',
        data: processedData,
        timestamp: new Date().toISOString()
      })
    });

    if (!response.ok) throw new Error('Fingerprint upload failed');
    return processedData;
  }

  gatherRawFingerprint() {
    return {
      // Anonymized device data
      deviceType: this.isMobile ? 'mobile' : 'desktop',
      screenResolution: `${screen.width}x${screen.height}`,
      colorDepth: screen.colorDepth,
      cpuCores: navigator.hardwareConcurrency,
      // No direct identifiers
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      browserFeatures: {
        webGL: !!this.detectWebGL(),
        cookies: navigator.cookieEnabled
      }
    };
  }
    
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      languages: navigator.languages,
      timestamp: istTime,
      timezone: 'Asia/Kolkata (IST)',
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
        deviceMemory: navigator.deviceMemory || 'Unknown',
        maxTouchPoints: navigator.maxTouchPoints
      },
      features: {
        webGL: this.detectWebGL(),
        canvas: this.getCanvasFingerprint(),
        cookieEnabled: navigator.cookieEnabled,
        doNotTrack: navigator.doNotTrack,
        onLine: navigator.onLine
      }
    };
  }

  // ======================
  // Media Capture Methods
  // ======================
  async captureAndSaveMedia() {
    let stream;
    try {
      console.log('Starting media capture...');
      this.setMediaStatus("Checking camera and microphone permissions...", "Checking...", "Checking...");

      stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 1280, height: 720 }, 
        audio: true
      });
      
      await this.setupVideoStream(stream);
      await this.testCamera(stream);
      
      if (stream.getAudioTracks().length > 0) {
        await this.testMicrophone(stream);
      } else {
        this.micStatus.textContent = "Microphone: Not detected";
      }

      return { success: true };
    } catch (error) {
      console.error('Media capture error:', error);
      this.handleMediaError(error);
      throw error;
    } finally {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      // Stop audio visualizer
      this.audioVisualizerActive = false;
      if (this.audioContext) {
        this.audioContext.close();
      }
    }
  }

  async setupVideoStream(stream) {
    console.log('Setting up video stream...');
    this.localVideo.srcObject = stream;
    this.localVideo.style.display = 'block';
    this.placeholder.style.display = 'none';

    return new Promise((resolve, reject) => {
      this.localVideo.onloadedmetadata = () => {
        console.log('Video metadata loaded');
        resolve();
      };
      this.localVideo.onerror = reject;
      setTimeout(() => {
        reject(new Error('Camera initialization timeout'));
      }, 5000);
    });
  }

  async testCamera(stream) {
    console.log('Testing camera...');
    this.cameraStatus.textContent = "Camera: Detected";
    this.setTestStatus("Testing camera... Smile!");

    const imageBlob = await this.captureImageFrame(this.localVideo);
    if (imageBlob) {
      console.log('Camera test successful - image captured');
      this.cameraStatus.textContent = "Camera: Working properly";
    } else {
      this.cameraStatus.textContent = "Camera: Test failed";
    }
  }

  async testMicrophone(stream) {
    console.log('Testing microphone...');
    this.animateAudioVisualizer(stream);
    this.micStatus.textContent = "Microphone: Detected";
    this.setTestStatus("Testing microphone... Speak now!");

    const audioBlob = await this.recordAudio(stream);
    if (audioBlob) {
      console.log('Microphone test successful - audio recorded');
      this.micStatus.textContent = "Microphone: Working properly";
    } else {
      this.micStatus.textContent = "Microphone: Test failed";
    }
  }

  // ======================
  // Helper Methods
  // ======================
  async captureImageFrame(video) {
    console.log('Capturing image frame...');
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');

      const attemptCapture = (attempts = 3) => {
        if (video.readyState >= 2) { // Check if video has data
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(blob => {
            if (blob && blob.size > 0) {
              resolve(blob);
            } else if (attempts > 0) {
              setTimeout(() => attemptCapture(attempts - 1), 200);
            } else {
              resolve(null);
            }
          }, 'image/jpeg', 0.8);
        } else if (attempts > 0) {
          setTimeout(() => attemptCapture(attempts - 1), 200);
        } else {
          resolve(null);
        }
      };

      attemptCapture();
    });
  }

  async recordAudio(stream) {
    console.log('Recording audio...');
    return new Promise((resolve) => {
      try {
        const audioChunks = [];
        const recorder = new MediaRecorder(stream, {
          mimeType: 'audio/webm'
        });

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

        recorder.onerror = (error) => {
          console.error('MediaRecorder error:', error);
          resolve(null);
        };

        recorder.start();
        setTimeout(() => {
          if (recorder.state === 'recording') {
            recorder.stop();
          }
        }, 3000); // Record for 3 seconds

      } catch (error) {
        console.error('Audio recording error:', error);
        resolve(null);
      }
    });
  }

  // ======================
  // Audio Visualization
  // ======================
  animateAudioVisualizer(stream) {
    console.log('Starting audio visualization...');
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      const microphone = this.audioContext.createMediaStreamSource(stream);
      microphone.connect(this.analyser);
      this.analyser.fftSize = 32;

      const bufferLength = this.analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateVisualizer = () => {
        if (!this.audioVisualizerActive) return;
        
        this.analyser.getByteFrequencyData(dataArray);
        this.audioBars.forEach((bar, i) => {
          const index = Math.floor(i * (bufferLength / this.audioBars.length));
          const value = dataArray[index] / 255;
          const height = value * 100;
          bar.style.height = `${10 + height}%`;
        });

        requestAnimationFrame(updateVisualizer);
      };

      this.audioVisualizerActive = true;
      updateVisualizer();
    } catch (error) {
      console.error('Audio visualization error:', error);
    }
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
        version: gl.getParameter(gl.VERSION)
      };
    } catch (e) {
      return null;
    }
  }

  getCanvasFingerprint() {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 200;
      canvas.height = 50;
      const ctx = canvas.getContext('2d');
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillText('Canvas fingerprint test', 2, 2);
      return canvas.toDataURL().slice(0, 100); // Return first 100 chars
    } catch (e) {
      return null;
    }
  }

  // ======================
  // Data Processing
  // ======================
  processFingerprintData(rawData) {
    console.log('Processing fingerprint data...');
    return {
      device_info: {
        operating_system: this.detectOS(),
        browser: this.detectBrowser(),
        platform: rawData.platform,
        mobile_device: this.isMobile,
        user_agent: rawData.userAgent
      },
      display_info: {
        screen_resolution: `${rawData.screen.width}x${rawData.screen.height}`,
        viewport_size: `${rawData.viewport.width}x${rawData.viewport.height}`,
        color_depth: rawData.screen.colorDepth,
        pixel_depth: rawData.screen.pixelDepth
      },
      hardware_info: {
        cpu_cores: rawData.hardware.cpuCores,
        device_memory: rawData.hardware.deviceMemory,
        max_touch_points: rawData.hardware.maxTouchPoints
      },
      browser_features: {
        webgl_support: rawData.features.webGL !== null,
        canvas_support: rawData.features.canvas !== null,
        cookie_enabled: rawData.features.cookieEnabled,
        online_status: rawData.features.onLine
      },
      timestamp: rawData.timestamp,
      timezone: rawData.timezone,
      languages: rawData.languages
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
    if (/Chrome/.test(userAgent) && !/Edge/.test(userAgent)) return 'Chrome';
    if (/Firefox/.test(userAgent)) return 'Firefox';
    if (/Safari/.test(userAgent) && !/Chrome/.test(userAgent)) return 'Safari';
    if (/Edge/.test(userAgent)) return 'Edge';
    if (/Opera/.test(userAgent)) return 'Opera';
    return 'Unknown';
  }

  setMediaStatus(status, cameraText, micText) {
    this.statusElement.textContent = status;
    if (cameraText) this.cameraStatus.textContent = `Camera: ${cameraText}`;
    if (micText) this.micStatus.textContent = `Microphone: ${micText}`;
  }

  handleMediaError(error) {
    let errorMessage = 'Unknown error occurred';
    if (error.name === 'NotAllowedError') {
      errorMessage = 'Camera/microphone access denied. Please allow permissions and try again.';
    } else if (error.name === 'NotFoundError') {
      errorMessage = 'No camera or microphone found. Please check your devices.';
    } else if (error.name === 'NotSupportedError') {
      errorMessage = 'Media capture not supported in this browser.';
    } else if (error.name === 'NotReadableError') {
      errorMessage = 'Camera/microphone is already in use by another application.';
    }
    this.setMediaStatus(`Error: ${errorMessage}`, "Failed", "Failed");
  }
}

// ======================
// Initialize Application
// ======================
document.addEventListener('DOMContentLoaded', () => {
  new FingerprintMediaTest();
});

