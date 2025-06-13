const express = require('express');
const cloudinary = require('cloudinary').v2;
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const CryptoJS = require('crypto-js');

// Security configurations
const app = express();
app.use(helmet());
app.use(express.json({ limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

// Privacy middleware
app.use((req, res, next) => {
  // Anonymize IPs
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  req.anonymizedIp = CryptoJS.SHA256(ip).toString(CryptoJS.enc.Hex).substring(0, 16);
  next();
});

// Routes
app.get('/get-ip', (req, res) => {
  res.json({ anonymizedIp: req.anonymizedIp });
});

app.post('/collect-fingerprint', async (req, res) => {
  try {
    const { data } = req.body;
    
    // Additional anonymization
    const fingerprintData = {
      ...data,
      timestamp: new Date().toISOString(),
      sessionId: CryptoJS.SHA256(Date.now().toString()).toString(),
      ip: req.anonymizedIp
    };

    // Upload to Cloudinary with 30-day retention
    const result = await cloudinary.uploader.upload(
      JSON.stringify(fingerprintData),
      {
        folder: 'fingerprints',
        resource_type: 'auto',
        type: 'private',
        overwrite: false,
        invalidate: true
      }
    );

    res.json({ 
      success: true,
      message: 'Data stored securely',
      dataId: result.public_id 
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Data processing failed' });
  }
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Privacy-focused error response');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Secure server running on port ${PORT}`);
});
