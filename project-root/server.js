const express = require('express');
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY || process.env.API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET || process.env.API_SECRET
});

const app = express();

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  next();
});

// Utility functions
function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
         req.headers['x-real-ip'] || 
         req.socket.remoteAddress || 
         req.connection.remoteAddress;
}

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

// Routes
app.get('/', (req, res) => {
  res.json({
    status: 'active',
    message: 'Device Compatibility Test Server Running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.post('/collect-fingerprint', async (req, res) => {
  try {
    const clientInfo = {
      ip: getClientIp(req),
      userAgent: req.headers['user-agent'],
      timestamp: new Date().toISOString()
    };

    const { type, data } = req.body;

    const enhancedData = {
      ...clientInfo,
      ...data,
      collection_type: 'PROCESSED_FINGERPRINT'
    };

    const result = await uploadToCloudinary(
      enhancedData,
      'device-tests/fingerprints/json',
      'fingerprint_data'
    );

    res.json({ 
      success: true, 
      message: 'Processed fingerprint saved successfully',
      data_url: result.secure_url,
      session_id: data.session_id
    });

  } catch (error) {
    console.error('Fingerprint collection error:', error);
    res.status(500).json({ 
      error: 'Failed to save fingerprint data',
      message: error.message 
    });
  }
});

app.post('/collect-media', async (req, res) => {
  try {
    const { type, media_type, data, extension, metadata } = req.body;

    if (type === 'processed_media') {
      // Upload media file
      const mediaResult = await cloudinary.uploader.upload(data, {
        folder: `device-tests/media/${media_type}`,
        public_id: `${media_type}_test_${Date.now()}`,
        resource_type: media_type === 'image' ? 'image' : 'video',
        format: extension
      });

      res.json({ 
        success: true, 
        message: `Processed ${media_type} saved successfully`,
        url: mediaResult.secure_url
      });
    } else {
      res.status(400).json({ error: 'Invalid media type' });
    }

  } catch (error) {
    console.error('Media upload error:', error);
    res.status(500).json({ error: 'Error uploading media' });
  }
});

// Error handler
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🔒 Device Compatibility Test Server running on port ${PORT}`);
});
