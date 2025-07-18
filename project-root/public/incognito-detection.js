/**
 * Advanced Private Browser Detection Module
 * Detects incognito/private mode across major browsers
 * @returns {Promise<{isPrivate: boolean, browserName: string, method: string}>}
 */
export default function detectIncognito() {
  return new Promise((resolve, reject) => {
    let browserName = 'Unknown';
    let detectionMethod = 'Not detected';
    let callbackSettled = false;

    function __callback(isPrivate, method) {
      if (callbackSettled) return;
      callbackSettled = true;
      resolve({ 
        isPrivate, 
        browserName, 
        method: method || detectionMethod 
      });
    }

    // Helper functions
    function feid() {
      let toFixedEngineID = 0;
      const neg = parseInt("-1");
      try {
        neg.toFixed(neg);
      } catch (e) {
        toFixedEngineID = e.message.length;
      }
      return toFixedEngineID;
    }

    function identifyChromium() {
      const ua = navigator.userAgent;
      if (ua.match(/Chrome/)) {
        if (navigator.brave !== undefined) return 'Brave';
        if (ua.match(/Edg/)) return 'Edge';
        if (ua.match(/OPR/)) return 'Opera';
        return 'Chrome';
      }
      return 'Chromium';
    }

    function assertEvalToString(value) {
      try {
        return value === eval.toString().length;
      } catch (e) {
        return false;
      }
    }

    // Browser identification
    function isSafari() { return feid() === 44; }
    function isChrome() { return feid() === 51; }
    function isFirefox() { return feid() === 25; }
    function isMSIE() {
      return navigator.msSaveBlob !== undefined && assertEvalToString(39);
    }

    // Safari detection
    async function safariPrivateTest() {
      detectionMethod = 'Safari-specific detection';
      if (navigator.storage?.getDirectory !== undefined) {
        try {
          await navigator.storage.getDirectory();
          __callback(false, 'Storage API');
        } catch (e) {
          const message = e instanceof Error ? e.message || e : e;
          if (typeof message === 'string') {
            __callback(message.includes('unknown transient reason'), 'Storage API error');
          } else {
            __callback(false, 'Storage API fallback');
          }
        }
      } else if (navigator.maxTouchPoints !== undefined) {
        // Safari 13-18
        const tmp = String(Math.random());
        try {
          const dbReq = indexedDB.open(tmp, 1);
          dbReq.onupgradeneeded = (ev) => {
            const db = ev.target.result;
            try {
              db.createObjectStore('t', { autoIncrement: true }).put(new Blob());
              __callback(false, 'IndexedDB blob storage');
            } catch (err) {
              const msg = err.message || '';
              __callback(msg.includes('are not yet supported'), 'IndexedDB error');
            } finally {
              db.close();
              indexedDB.deleteDatabase(tmp);
            }
          };
          dbReq.onerror = () => __callback(false, 'IndexedDB fallback');
        } catch (_) {
          __callback(false, 'IndexedDB exception');
        }
      } else {
        // Old Safari
        try {
          window.openDatabase(null, null, null, null);
          localStorage.setItem('test', '1');
          localStorage.removeItem('test');
          __callback(false, 'WebSQL+localStorage');
        } catch (e) {
          __callback(true, 'WebSQL+localStorage blocked');
        }
      }
    }

    // Chrome/Chromium detection
    function chromePrivateTest() {
      detectionMethod = 'Chromium-specific detection';
      if (self.Promise?.allSettled !== undefined) {
        // Chrome 76+
        navigator.webkitTemporaryStorage.queryUsageAndQuota(
          (_, quota) => {
            const quotaInMib = Math.round(quota / (1024 * 1024));
            const quotaLimit = window.performance?.memory?.jsHeapSizeLimit || 1073741824;
            const quotaLimitInMib = Math.round(quotaLimit / (1024 * 1024)) * 2;
            __callback(quotaInMib < quotaLimitInMib, 'Storage quota check');
          },
          (e) => __callback(false, 'Storage quota error')
        );
      } else {
        // Chrome 50-75
        window.webkitRequestFileSystem(0, 1, 
          () => __callback(false, 'Filesystem API'), 
          () => __callback(true, 'Filesystem API blocked')
        );
      }
    }

    // Firefox detection
    async function firefoxPrivateTest() {
      detectionMethod = 'Firefox-specific detection';
      if (navigator.storage?.getDirectory) {
        try {
          await navigator.storage.getDirectory();
          __callback(false, 'Storage API');
        } catch (e) {
          const message = (e instanceof Error && e.message) ? e.message : String(e);
          __callback(message.includes('Security error'), 'Storage API error');
        }
      } else {
        __callback(navigator.serviceWorker === undefined, 'ServiceWorker check');
      }
    }

    // MSIE detection
    function msiePrivateTest() {
      detectionMethod = 'IE-specific detection';
      __callback(window.indexedDB === undefined, 'IndexedDB check');
    }

    // Main detection logic
    (async () => {
      try {
        if (isSafari()) {
          browserName = 'Safari';
          await safariPrivateTest();
        } else if (isChrome()) {
          browserName = identifyChromium();
          chromePrivateTest();
        } else if (isFirefox()) {
          browserName = 'Firefox';
          await firefoxPrivateTest();
        } else if (isMSIE()) {
          browserName = 'Internet Explorer';
          msiePrivateTest();
        } else {
          // Fallback for unknown browsers
          __callback(false, 'Browser not recognized');
        }
      } catch (err) {
        reject(err);
      }
    })();
  });
}

// Make available globally if needed
if (typeof window !== 'undefined') {
  window.detectIncognito = detectIncognito;
} 