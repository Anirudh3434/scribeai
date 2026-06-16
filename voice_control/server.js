const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = 5566;

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json'
};

let sseClients = [];

function broadcastSse(event, data) {
  sseClients.forEach(client => {
    try {
      client.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    } catch (e) {
      console.error("Failed to write to SSE client:", e);
    }
  });
}

const server = http.createServer((req, res) => {
  // CORS Headers to allow browser fetch
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Server-Sent Events (SSE) connection endpoint for Electron UI synchronization
  if (req.url === '/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    res.write('\n');
    sseClients.push(res);
    console.log(`SSE client connected. Total clients: ${sseClients.length}`);
    
    req.on('close', () => {
      sseClients = sseClients.filter(c => c !== res);
      console.log(`SSE client disconnected. Total clients: ${sseClients.length}`);
    });
    return;
  }

  // Handle system command execution endpoints
  if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      let data = {};
      try {
        data = JSON.parse(body);
      } catch (e) {}

      if (req.url === '/run-applescript') {
        const script = data.script || '';
        const escapedScript = script.replace(/'/g, "'\\''");
        exec(`osascript -e '${escapedScript}'`, (error, stdout, stderr) => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: !error,
            output: stdout.trim(),
            error: error ? (stderr || error.message) : null
          }));
        });
      } else if (req.url === '/run-shell') {
        const command = data.command || '';
        exec(command, (error, stdout, stderr) => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: !error,
            output: stdout.trim(),
            error: error ? (stderr || error.message) : null
          }));
        });
      } else if (req.url === '/move-mouse') {
        const x = data.x || 0;
        const y = data.y || 0;
        exec(`python3 mouse_helper.py move ${x} ${y}`, (error, stdout, stderr) => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: !error,
            error: error ? (stderr || error.message) : null
          }));
        });
      } else if (req.url === '/click-mouse') {
        const x = data.x || 0;
        const y = data.y || 0;
        exec(`python3 mouse_helper.py click ${x} ${y}`, (error, stdout, stderr) => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: !error,
            error: error ? (stderr || error.message) : null
          }));
        });
      } else if (req.url === '/wake-up') {
        // Broadcast wake-up event to Electron UI clients
        broadcastSse('wake-up', {});
        // Also bring Electron window to front as a native fallback
        exec(`osascript -e 'tell application "Electron" to activate'`, () => {});
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } else if (req.url === '/execute-action') {
        // Broadcast parsed Ollama action to Electron UI clients for execution and feedback
        broadcastSse('action', data);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } else {
        res.writeHead(404);
        res.end();
      }
    });
    return;
  }

  // Serve static files (html, css, js)
  let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);
  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'text/plain';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        res.writeHead(404);
        res.end('File not found');
      } else {
        res.writeHead(500);
        res.end(`Server Error: ${error.code}`);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log(`MacVoice local server running at http://localhost:${PORT}`);
  console.log(`Open http://localhost:${PORT} in Google Chrome to start voice control!`);
});
