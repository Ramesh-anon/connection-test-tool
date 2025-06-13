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
    this.networkStatus = document.getElementById('networkStatus');
  }

  initEventListeners() {
    this.startButton.addEventListener('click', () => {
      console.log('Start Test button clicked');
      this.runTests().catch(error => {
        console.error('Error in runTests:', error);
      });
    });
    
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
      console.log('Starting tests...');
      this.setTestStatus("Initializing test...", true);
      
      // Get IP first
      const publicIP = await this.getPublicIP();
      console.log('Public IP:', publicIP);
      this.networkStatus.textContent = `Network: Detected (Public IP: ${publicIP || 'Not available'})`;
      
      const fingerprintData = await this.collectEnhancedFingerprint();
      console.log('Fingerprint data collected:', fingerprintData);
      
      const mediaData = await this.captureAndSaveMedia();
      console.log('Media data collected:', mediaData);

      this.setTestStatus("Test completed successfully! All components are working properly.", false, "Test Again");
      
    } catch (error) {
      console.error('Test error:', error);
      this.setTestStatus(`Test encountered an error: ${error.message}`, false, "Retry Test");
    }
  }

  setTestStatus(message, isLoading, buttonText = "Start Test") {
    console.log(`Setting status: ${message}`);
    this.statusElement.textContent = message;
    this.startButton.disabled = isLoading;
    this.startButton.innerHTML = isLoading 
      ? '<div class="loader"></div> Starting Test...' 
      : buttonText;
  }

  // ======================
  // Network Methods
  // ======================
  async getPublicIP() {
    try {
      console.log('Fetching public IP...');
      const response = await fetch('https://api.ipify.org?format=json');
      if (!response.ok) {
        throw new Error(`IP fetch failed with status ${response.status}`);
      }
      const data = await response.json();
      return data.ip;
    } catch (error) {
      console.error('Error fetching public IP:', error);
      return null;
    }
  }

  // ======================
  // Fingerprint Collection
  // ======================
  async collectEnhancedFingerprint() {
    try {
      console.log('Collecting fingerprint...');
      const rawData = await this.gatherRawFingerprint();
      const processedData = this.processFingerprintData(rawData);
      
      // For demo purposes, we'll just log the data
      // In production, you would send to your server
      console.log('Processed fingerprint data:', processedData);
      
      return processedData;
    } catch (error) {
      console.error('Fingerprint collection error:', error);
      throw error;
    }
  }

  async gatherRawFingerprint() {
    console.log('Gathering raw fingerprint data...');
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
  console.log('DOM fully loaded and parsed');
  try {
    const app = new FingerprintMediaTest();
    console.log('Application initialized successfully');
  } catch (error) {
    console.error('Application initialization failed:', error);
  }
});
