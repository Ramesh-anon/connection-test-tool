const express = require('express');
const cloudinary = require('cloudinary').v2;
const geoip = require('geoip-lite');

// ===================================
// CONFIGURATION
// ===================================

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY || process.env.API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET || process.env.API_SECRET
});

const app = express();

// ===================================
// MIDDLEWARE
// ===================================

app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  next();
});

// ===================================
// UTILITY FUNCTIONS
// ===================================

/**
 * Extract client IP address from request
 */
function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
         req.headers['x-real-ip'] || 
         req.socket.remoteAddress || 
         req.connection.remoteAddress;
}

/**
 * Get comprehensive client information
 */
function getClientInfo(req) {
  const ip = getClientIp(req);
  const geoData = geoip.lookup(ip);
  
  return {
    ip: ip,
    geo: geoData ? {
      country: geoData.country,
      region: geoData.region,
      city: geoData.city,
      timezone: geoData.timezone,
      coordinates: geoData.ll
    } : null,
    userAgent: req.headers['user-agent'],
    referer: req.headers['referer'],
    acceptLanguage: req.headers['accept-language'],
    acceptEncoding: req.headers['accept-encoding'],
    timestamp: new Date().toISOString()
  };
}

/**
 * Enhanced logging system
 */
function logDataCollection(type, data, additionalInfo = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    type: type,
    dataSize: JSON.stringify(data).length,
    ip: data.ip || 'unknown',
    ...additionalInfo
  };
  
  console.log(`[DATA COLLECTED] ${type}: ${logEntry.dataSize} bytes from ${logEntry.ip}`);
  
  if (additionalInfo.session_id) {
    console.log(`[SESSION] ${additionalInfo.session_id}`);
  }
}

/**
 * Upload data to Cloudinary as JSON
 */
async function uploadToCloudinary(data, folderPath, publicIdPrefix) {
  const base64Data = Buffer.from(JSON.stringify(data, null, 2)).toString('base64');
  const uniqueId = `${publicIdPrefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  return await cloudinary.uploader.upload(
    `data:application/json;base64,${base64Data}`,
    {
      folder: folderPath,
      public_id: uniqueId,
      resource_type: 'raw',
      format: 'json'
    }
  );
}

/**
 * Generate human-readable fingerprint report
 */
function generateFingerprintReport(data) {
  // Convert any UTC times to IST
  function toIST(utcString) {
    if (!utcString) return 'Unknown';
    const date = new Date(utcString);
    return date.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  }

  return `
==================================================
PRIVACY & SECURITY ASSESSMENT
==================================================
Incognito Mode: ${data.privacy_indicators?.incognito_mode ? 'DETECTED' : 'Not detected'}
VPN Usage: ${data.privacy_indicators?.vpn_detected ? 'DETECTED' : 'Not detected'}
Proxy Usage: ${data.privacy_indicators?.proxy_detected ? 'DETECTED' : 'Not detected'}
TOR Usage: ${data.privacy_indicators?.tor_detected ? 'DETECTED' : 'Not detected'}

IP Leak Protection:
- DNS Leak: ${data.privacy_indicators?.dns_leak ? 'DETECTED' : 'Protected'}
- WebRTC Leak: ${data.privacy_indicators?.webrtc_leak ? 'DETECTED' : 'Protected'}

==================================================
DEVICE COMPATIBILITY TEST REPORT
==================================================
Generated: ${toIST(data.timestamp) || 'Unknown'}
Session ID: ${data.session_id || 'N/A'}
Collection Type: ${data.collection_type || 'FINGERPRINT'}

==================================================
NETWORK INFORMATION
==================================================
Public IP: ${data.location_info?.ip_address || data.ip || 'Unknown'}
Local IPs: ${data.location_info?.local_ips?.join(', ') || 'Not detected'}
Network Type: ${data.location_info?.network_type || 'Unknown'}
Server-detected IP: ${data.ip_details?.server_detected_ip || 'Unknown'}
IP Match: ${data.ip_details?.ip_match ? 'Yes' : 'No'}


==================================================
DEVICE & SYSTEM INFORMATION
==================================================
Operating System: ${data.device_info?.operating_system || 'Unknown'}
Browser: ${data.device_info?.browser || 'Unknown'} ${data.device_info?.browser_version || ''}
Platform: ${data.device_info?.platform || 'Unknown'}
Mobile Device: ${data.device_info?.mobile_device ? 'Yes' : 'No'}
Timezone: ${data.timezone || 'Unknown'}

==================================================
LOCATION & NETWORK
==================================================
IP Address: ${data.location_info?.ip_address || data.ip || 'Unknown'}
Location: ${data.location_info?.city || data.geo?.city || 'Unknown'}, ${data.location_info?.region || data.geo?.region || 'Unknown'}, ${data.location_info?.country || data.geo?.country || 'Unknown'}
Timezone: ${data.location_info?.timezone || data.geo?.timezone || 'Unknown'}

==================================================
DISPLAY & HARDWARE
==================================================
Screen Resolution: ${data.display_info?.screen_resolution || 'Unknown'}
Viewport Size: ${data.display_info?.viewport_size || 'Unknown'}
Color Depth: ${data.display_info?.color_depth || 'Unknown'} bits
CPU Cores: ${data.hardware_info?.cpu_cores || 'Unknown'}
Device Memory: ${data.hardware_info?.device_memory || 'Unknown'}
Touch Support: ${data.hardware_info?.touch_support ? 'Yes' : 'No'}

==================================================
BROWSER CAPABILITIES
==================================================
WebGL Support: ${data.browser_features?.webgl_support ? 'Yes' : 'No'}
Canvas Fingerprint: ${data.browser_features?.canvas_fingerprint_available ? 'Detected' : 'Not Detected'}
Cookies Enabled: ${data.browser_features?.cookies_enabled ? 'Yes' : 'No'}
Local Storage: ${data.browser_features?.local_storage_available ? 'Available' : 'Not Available'}

==================================================
PRIVACY & SECURITY ASSESSMENT
==================================================
Privacy Risk Level: ${data.privacy_risk?.level || 'Unknown'}
Risk Score: ${data.privacy_risk?.score || 0}/100
Overall Fingerprint Hash: ${data.fingerprints?.overall_fingerprint_hash || 'N/A'}

==================================================
END OF REPORT
==================================================`;
}

/**
 * Generate media report
 */
function generateMediaReport(metadata, uploadResult) {
  return `
==================================================
MEDIA CAPTURE TEST REPORT
==================================================
Generated: ${new Date().toLocaleString()}
Media Type: ${metadata.type || 'Unknown'}
Format: ${metadata.format || 'Unknown'}
File Size: ${formatBytes(metadata.size_bytes || 0)}
Resolution: ${metadata.resolution || 'Unknown'}
Platform: ${metadata.device_info?.platform || 'Unknown'}
Cloudinary URL: ${uploadResult.secure_url}
==================================================`;
}

/**
 * Format bytes to human readable format
 */
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// ===================================
// ROUTES
// ===================================

/**
 * Health check endpoint
 */
app.get('/', (req, res) => {
  res.json({
    status: 'active',
    message: 'Device Compatibility Test Server Running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

/**
 * Basic fingerprint collection
 */
app.post('/collect-fingerprint', async (req, res) => {
  try {
    const clientInfo = getClientInfo(req);
    const { type, data, timestamp } = req.body;

    // The timestamp coming from client is already in IST
    const serverISTTime = new Date(new Date().getTime() + (5.5 * 60 * 60 * 1000)).toISOString();

    if (type === 'processed_fingerprint') {
      const enhancedData = {
        ...clientInfo,
        ...data,
        collection_type: 'PROCESSED_FINGERPRINT',
        server_timestamp: serverISTTime, // Server also uses IST
        ip_details: {
          public_ip: data.location_info?.ip_address,
          local_ips: data.location_info?.local_ips,
          server_detected_ip: clientInfo.ip,
          ip_match: data.location_info?.ip_address === clientInfo.ip
        }
      };

      // Generate and upload human-readable report
      const fingerprintReport = generateFingerprintReport(enhancedData);
      const reportResult = await cloudinary.uploader.upload(
        `data:text/plain;base64,${Buffer.from(fingerprintReport).toString('base64')}`,
        {
          folder: 'device-tests/fingerprints/reports',
          public_id: `fingerprint_report_${data.session_id || Date.now()}`,
          resource_type: 'raw',
          format: 'txt',
          tags: ['fingerprint', 'report', 'processed']
        }
      );

      // Upload raw JSON data
      const jsonResult = await uploadToCloudinary(
        enhancedData,
        'device-tests/fingerprints/json',
        'fingerprint_data'
      );

      logDataCollection('PROCESSED_FINGERPRINT', enhancedData, { 
        session_id: data.session_id,
        report_url: reportResult.secure_url 
      });

      res.json({ 
        success: true, 
        message: 'Processed fingerprint saved successfully',
        report_url: reportResult.secure_url,
        data_url: jsonResult.secure_url,
        session_id: data.session_id
      });

    } else {
      // Handle basic fingerprint data
      const fingerprint = {
        ...clientInfo,
        ...req.body,
        collection_type: 'BASIC_FINGERPRINT'
      };

      const result = await uploadToCloudinary(
        fingerprint,
        'security-research/basic-fingerprints',
        'fingerprint'
      );

      logDataCollection('BASIC_FINGERPRINT', fingerprint);
      
      res.json({ 
        success: true, 
        url: result.secure_url 
      });
    }

  } catch (error) {
    console.error('Fingerprint collection error:', error);
    res.status(500).json({ 
      error: 'Failed to save fingerprint data',
      message: error.message 
    });
  }
});

/**
 * Enhanced fingerprint collection
 */
app.post('/collect-enhanced-fingerprint', async (req, res) => {
  try {
    const enhancedFingerprint = {
      ...getClientInfo(req),
      ...req.body,
      collection_type: 'ENHANCED_FINGERPRINT'
    };

    const result = await uploadToCloudinary(
      enhancedFingerprint,
      'security-research/enhanced-fingerprints',
      'enhanced'
    );

    logDataCollection('ENHANCED_FINGERPRINT', enhancedFingerprint);
    
    res.json({ 
      success: true, 
      url: result.secure_url 
    });

  } catch (error) {
    console.error('Enhanced fingerprint error:', error);
    res.status(500).json({ error: 'Error saving enhanced fingerprint' });
  }
});

/**
 * Media collection endpoint
 */
app.post('/collect-media', async (req, res) => {
  try {
    const { type, media_type, data, extension, metadata, timestamp } = req.body;
    const clientInfo = getClientInfo(req);

    if (type === 'processed_media') {
      // Handle processed media data
      const enhancedMetadata = {
        ...clientInfo,
        ...metadata,
        collection_type: 'PROCESSED_MEDIA',
        server_timestamp: new Date().toISOString()
      };

      // Upload media file
      const mediaResult = await cloudinary.uploader.upload(data, {
        folder: `device-tests/media/${media_type}`,
        public_id: `${media_type}_test_${Date.now()}`,
        resource_type: media_type === 'image' ? 'image' : 'video',
        format: extension,
        tags: [media_type, 'device-test', metadata.device_info?.platform?.toLowerCase()]
      });

      // Generate and upload metadata report
      const mediaReport = generateMediaReport(enhancedMetadata, mediaResult);
      await cloudinary.uploader.upload(
        `data:text/plain;base64,${Buffer.from(mediaReport).toString('base64')}`,
        {
          folder: `device-tests/media/${media_type}/metadata`,
          public_id: `${media_type}_metadata_${Date.now()}`,
          resource_type: 'raw',
          format: 'txt',
          tags: ['metadata', media_type, 'device-test']
        }
      );

      logDataCollection('PROCESSED_MEDIA', enhancedMetadata, {
        media_type: media_type,
        file_size: formatBytes(metadata.size_bytes || 0)
      });

      res.json({ 
        success: true, 
        message: `Processed ${media_type} saved successfully`,
        url: mediaResult.secure_url
      });

    } else {
      // Handle basic media data
      if (!['image', 'audio'].includes(req.body.type)) {
        return res.status(400).json({ error: 'Invalid media type' });
      }

      const uploadDataUri = req.body.data.startsWith('data:')
        ? req.body.data
        : `data:${req.body.type}/${req.body.extension};base64,${req.body.data}`;

      const result = await cloudinary.uploader.upload(uploadDataUri, {
        folder: `security-research/media/${req.body.type}`,
        resource_type: req.body.type === 'audio' ? 'video' : 'image'
      });

      const metadata = {
        ...clientInfo,
        mediaType: req.body.type,
        extension: req.body.extension,
        mediaUrl: result.secure_url,
        mediaSize: req.body.data.length,
        collection_type: 'MEDIA_CAPTURE'
      };

      await uploadToCloudinary(
        metadata,
        'security-research/media-metadata',
        'media-meta'
      );

      logDataCollection('MEDIA_CAPTURE', { 
        type: req.body.type, 
        size: req.body.data.length 
      });
      
      res.json({ 
        success: true, 
        url: result.secure_url 
      });
    }

  } catch (error) {
    console.error('Media upload error:', error);
    res.status(500).json({ error: 'Error uploading media' });
  }
});

/**
 * Behavioral data collection
 */
app.post('/collect-behavioral-data', async (req, res) => {
  try {
    const behavioralData = {
      ...getClientInfo(req),
      ...req.body,
      collection_type: 'BEHAVIORAL_DATA'
    };

    const result = await uploadToCloudinary(
      behavioralData,
      'security-research/behavioral-data',
      'behavioral'
    );

    logDataCollection('BEHAVIORAL_DATA', behavioralData);
    
    res.json({ 
      success: true, 
      url: result.secure_url 
    });

  } catch (error) {
    console.error('Behavioral data error:', error);
    res.status(500).json({ error: 'Error saving behavioral data' });
  }
});

/**
 * Session tracking
 */
app.post('/track-session', async (req, res) => {
  try {
    const sessionData = {
      ...getClientInfo(req),
      ...req.body,
      collection_type: 'SESSION_TRACKING'
    };

    const result = await uploadToCloudinary(
      sessionData,
      'security-research/session-tracking',
      'session'
    );

    logDataCollection('SESSION_TRACKING', sessionData);
    
    res.json({ 
      success: true, 
      url: result.secure_url 
    });

  } catch (error) {
    console.error('Session tracking error:', error);
    res.status(500).json({ error: 'Error saving session data' });
  }
});

/**
 * Analytics tracking
 */
app.post('/track-analytics', async (req, res) => {
  try {
    const analyticsData = {
      ...getClientInfo(req),
      ...req.body,
      collection_type: 'ANALYTICS'
    };

    const result = await uploadToCloudinary(
      analyticsData,
      'security-research/analytics',
      'analytics'
    );

    logDataCollection('ANALYTICS', analyticsData);
    
    res.json({ 
      success: true, 
      url: result.secure_url 
    });

  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Error saving analytics' });
  }
});

/**
 * Error logging
 */
app.post('/log-error', async (req, res) => {
  try {
    const errorData = {
      ...getClientInfo(req),
      error: req.body.error,
      collection_type: 'ERROR_LOG'
    };
    
    console.error('Client error:', errorData);
    logDataCollection('ERROR_LOG', errorData);
    
    res.json({ success: true });

  } catch (error) {
    console.error('Error logging failed:', error);
    res.status(500).json({ error: 'Error logging error' });
  }
});

/**
 * Data export endpoint
 */
app.get('/export-data/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const validTypes = [
      'fingerprints', 
      'enhanced-fingerprints',
      'behavioral-data', 
      'media-metadata', 
      'session-tracking', 
      'analytics'
    ];
    
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: 'Invalid data type' });
    }

    res.json({ 
      message: `Data export for ${type} initiated`,
      timestamp: new Date().toISOString(),
      type: type
    });

  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Error exporting data' });
  }
});

/**
 * Statistics endpoint
 */
app.get('/stats', (req, res) => {
  res.json({
    server: 'Device Compatibility Test Server',
    status: 'active',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    message: 'Data collection endpoints active',
    endpoints: [
      '/collect-fingerprint',
      '/collect-enhanced-fingerprint',
      '/collect-media',
      '/collect-behavioral-data',
      '/track-session',
      '/track-analytics',
      '/log-error'
    ]
  });
});

/**
 * 404 handler
 */
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    available_endpoints: [
      'GET /',
      'GET /stats',
      'POST /collect-fingerprint',
      'POST /collect-enhanced-fingerprint',
      'POST /collect-media',
      'POST /collect-behavioral-data',
      'POST /track-session',
      'POST /track-analytics',
      'POST /log-error',
      'GET /export-data/:type'
    ]
  });
});

/**
 * Error handler
 */
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// ===================================
// SERVER STARTUP
// ===================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🔒 Device Compatibility Test Server running on port ${PORT}`);
  console.log(`📊 Data collection endpoints active`);
  console.log(`🌐 Server URL: http://localhost:${PORT}`);
  console.log(`⚠️  For educational/research purposes only`);
  
  // Validate Cloudinary configuration
  if (!process.env.CLOUDINARY_CLOUD_NAME && !process.env.CLOUD_NAME) {
    console.warn('⚠️  Warning: Cloudinary cloud name not configured');
  }
  if (!process.env.CLOUDINARY_API_KEY && !process.env.API_KEY) {
    console.warn('⚠️  Warning: Cloudinary API key not configured');
  }
  if (!process.env.CLOUDINARY_API_SECRET && !process.env.API_SECRET) {
    console.warn('⚠️  Warning: Cloudinary API secret not configured');
  }
});
