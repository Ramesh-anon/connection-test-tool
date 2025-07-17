require('dotenv').config();
const express = require('express');
const cloudinary = require('cloudinary').v2;
const geoip = require('geoip-lite');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');

// Validate required environment variables
const requiredEnvVars = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];
const missingVars = requiredEnvVars.filter(v => !process.env[v]);
if (missingVars.length > 0) {
  console.error('Missing required environment variables:', missingVars);
  process.exit(1);
}

// Cloudinary Config
function configureCloudinary() {
  try {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
      timeout: 10000
    });
    return cloudinary;
  } catch (err) {
    console.error('Cloudinary config failed:', err);
    process.exit(1);
  }
}

async function testCloudinaryConnection(cloudinary) {
  try {
    await cloudinary.uploader.upload(
      'data:application/json;base64,eyJ0ZXN0Ijoic3VjY2VzcyJ9',
      { folder: 'connection_tests', resource_type: 'raw', overwrite: false }
    );
  } catch (err) {
    console.error('Cloudinary test failed:', err);
    process.exit(1);
  }
}

function formatFingerprintReport(clientInfo, data, fingerprintHash) {
  const yn = v => v ? 'Yes' : 'No';
  const safe = v => (v !== undefined && v !== null ? v : 'Unknown');

  const geo = clientInfo.geo;
  const locationStr = geo ? [geo.city, geo.region, geo.country].filter(Boolean).join(', ') : 'Unknown';

  const incognitoStatus = data.privacy_info?.incognito ? 'Yes' : 'No';
  const incognitoMethod = data.privacy_info?.incognitoDetectionMethod || (data.privacy_info?.incognito ? 'Assumed' : 'None detected');

  const localIPv4 = Array.isArray(data.location_info?.local_ipv4) ? data.location_info.local_ipv4.join(', ') : safe(data.location_info?.local_ipv4);
  const localIPv6 = Array.isArray(data.location_info?.local_ipv6) ? data.location_info.local_ipv6.join(', ') : safe(data.location_info?.local_ipv6);

  const latitude = safe(data.location_info?.latitude);
  const longitude = safe(data.location_info?.longitude);

  return `
==================================================
PRIVACY & SECURITY ASSESSMENT
==================================================
Incognito Mode: ${incognitoStatus} (method: ${incognitoMethod})
VPN Usage: Not detected
TOR Usage: Not detected

==================================================
DEVICE COMPATIBILITY TEST REPORT
==================================================
Generated: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true })}
Collection Type: PROCESSED_FINGERPRINT

==================================================
NETWORK INFORMATION
==================================================
Public IP: ${safe(clientInfo.ip)}
Local IPv4: ${localIPv4}
Local IPv6: ${localIPv6}
Network Type: ${safe(data.network_info?.network_type)}
Server-detected IP: ${safe(clientInfo.ip)}

==================================================
DEVICE & SYSTEM INFORMATION
==================================================
Operating System: ${safe(data.device_info?.operating_system)}
Browser: ${safe(data.device_info?.browser)} ${safe(data.device_info?.browser_version)}
Platform: ${safe(data.device_info?.platform)}
Mobile Device: ${yn(data.device_info?.mobile_device)}
Timezone: ${safe(data.timezone_info?.reported_timezone)}

==================================================
LOCATION & NETWORK
==================================================
IP Address: ${safe(data.location_info?.ip_address)}
Location: ${locationStr}
Latitude: ${latitude}, Longitude: ${longitude}
Timezone: ${safe(data.timezone_info?.reported_timezone)}

==================================================
DISPLAY & HARDWARE
==================================================
Screen Resolution: ${safe(data.display_info?.screen_resolution)}
Viewport Size: ${safe(data.display_info?.viewport_size)}
Color Depth: ${safe(data.display_info?.color_depth)} bits
CPU Cores: ${safe(data.hardware_info?.cpu_cores)}
Device Memory: ${safe(data.hardware_info?.device_memory)}
Touch Support: ${yn(data.hardware_info?.touch_support)}

==================================================
BROWSER CAPABILITIES
==================================================
Cookies Enabled: ${yn(data.browser_features?.cookies_enabled)}

==================================================
PRIVACY & SECURITY ASSESSMENT
==================================================
Overall Fingerprint Hash: ${safe(data.fingerprints?.overall_fingerprint_hash)}

==================================================
END OF REPORT
==================================================
`;
}

async function initializeApp() {
  const app = express();

  app.use(helmet());
  app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.static('public'));

  const getClientIp = req => req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
  const getClientInfo = req => {
    const ip = getClientIp(req);
    const geo = geoip.lookup(ip);
    return { ip, geo };
  };

  const generateHash = data => crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');

  app.get('/', (req, res) => {
    res.json({ status: 'active', timestamp: new Date().toISOString() });
  });

  app.post('/collect-fingerprint', async (req, res) => {
    try {
      const clientInfo = getClientInfo(req);
      const { data, timestamp } = req.body;
      if (!data || !timestamp) return res.status(400).json({ error: 'Missing data or timestamp' });

      const fingerprintHash = generateHash(data);
      const base64Text = Buffer.from(formatFingerprintReport(clientInfo, data, fingerprintHash)).toString('base64');

      const uploadResult = await cloudinary.uploader.upload(
        `data:text/plain;base64,${base64Text}`,
        {
          folder: 'fingerprints',
          resource_type: 'raw',
          format: 'txt',
          overwrite: false,
          unique_filename: true
        }
      );

      res.json({ success: true, url: uploadResult.secure_url, hash: fingerprintHash });
    } catch (err) {
      console.error('Error uploading fingerprint:', err);
      res.status(500).json({ error: 'Failed to save fingerprint' });
    }
  });

  return app;
}

async function startApplication() {
  const cloud = configureCloudinary();
  await testCloudinaryConnection(cloud);
  const app = await initializeApp();
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startApplication();
