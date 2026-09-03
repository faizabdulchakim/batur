import http from 'http';
import fs from 'fs';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import OpusScript from 'opusscript';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_FILE = path.join(__dirname, 'config.json');
const PUBLIC_DIR = path.join(__dirname, 'public');
const PORT = process.env.PORT || 3000;

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json'
};

// HTTP Server
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  // API: Get Device Config
  if (url.pathname === '/api/config' && req.method === 'GET') {
    if (fs.existsSync(CONFIG_FILE)) {
      try {
        const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(config));
        return;
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: e.message }));
        return;
      }
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'config.json not found' }));
      return;
    }
  }

  // API: TTS Fetch proxy (to bypass CORS in browser)
  if (url.pathname === '/api/tts' && req.method === 'GET') {
    const text = url.searchParams.get('text') || 'Halo';
    const lang = url.searchParams.get('lang') || 'id';
    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${lang}&client=tw-ob`;

    try {
      const ttsRes = await fetch(ttsUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        }
      });
      if (!ttsRes.ok) {
        res.writeHead(ttsRes.status, { 'Content-Type': 'text/plain' });
        res.end('TTS Fetch error');
        return;
      }
      const audioBuffer = Buffer.from(await ttsRes.arrayBuffer());
      res.writeHead(200, {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.length
      });
      res.end(audioBuffer);
      return;
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end(`TTS Error: ${e.message}`);
      return;
    }
  }

  // Serve static files
  let filePath = path.join(PUBLIC_DIR, url.pathname === '/' ? 'index.html' : url.pathname);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

// WebSocket Server (Audio Streaming Proxy Bridge to XiaoZhi)
const wss = new WebSocketServer({ server });

wss.on('connection', (clientWs) => {
  console.log('\n🔌 [Proxy] Browser client terhubung.');

  let config = {};
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    } catch (e) {
      console.error('❌ Gagal membaca config.json:', e.message);
    }
  }

  const wsUrl = config.ws_url || 'wss://api.tenclass.net/xiaozhi/v1/';
  console.log(`🌐 [Proxy] Menghubungkan ke XiaoZhi Server: ${wsUrl}`);
  console.log(`📌 Device MAC: ${config.mac_address} | Client ID: ${config.client_id}`);

  // Inisialisasi Opus Codec untuk sesi ini
  // Encoder: 16kHz Mono -> Opus frames untuk dikirim ke XiaoZhi
  const opusEncoder = new OpusScript(16000, 1, OpusScript.Application.VOIP);
  // Decoder: 24kHz Mono Opus frames dari XiaoZhi -> 24kHz PCM untuk browser
  const opusDecoder = new OpusScript(24000, 1, OpusScript.Application.AUDIO);

  const FRAME_SAMPLES_16K = 960; // 60ms @ 16kHz
  const FRAME_BYTES_16K = FRAME_SAMPLES_16K * 2; // 1920 bytes PCM (16-bit)
  let pcmInputBuffer = Buffer.alloc(0);

  let upstreamWs = null;
  const messageQueue = [];

  try {
    upstreamWs = new WebSocket(wsUrl, {
      headers: {
        'Authorization': `Bearer ${config.ws_token || 'test-token'}`,
        'Protocol-Version': '1',
        'Device-Id': config.mac_address || '24:dc:c3:00:00:01',
        'Client-Id': config.client_id || 'default-client-id'
      }
    });
  } catch (err) {
    console.error('❌ Upstream connection failed:', err.message);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(JSON.stringify({
        type: 'alert',
        status: 'ERROR',
        message: 'Gagal membuat koneksi upstream ke XiaoZhi'
      }));
    }
    return;
  }

  upstreamWs.on('open', () => {
    console.log('✅ [Proxy] Upstream terhubung ke XiaoZhi!');

    // 1. Kirim hello handshake otomatis
    const helloPayload = {
      type: 'hello',
      version: 1,
      features: { mcp: true, aec: true },
      transport: 'websocket',
      audio_params: {
        format: 'opus',
        sample_rate: 16000,
        channels: 1,
        frame_duration: 60
      }
    };
    upstreamWs.send(JSON.stringify(helloPayload));
    console.log('📤 [Proxy -> XiaoZhi]: Hello Handshake sent');

    // 2. Beri tahu browser
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(JSON.stringify({
        type: 'proxy_connected',
        message: 'Terhubung ke server XiaoZhi via Proxy'
      }));
    }

    // 3. Flush antrean
    while (messageQueue.length > 0) {
      const item = messageQueue.shift();
      if (item.isBinary) {
        upstreamWs.send(item.data, { binary: true });
      } else {
        upstreamWs.send(item.data, { binary: false });
      }
    }
  });

  upstreamWs.on('message', (data, isBinary) => {
    if (isBinary) {
      // Data biner adalah Opus audio frame dari XiaoZhi (24kHz Mono)
      try {
        const decodedPCM = opusDecoder.decode(data);
        // Kirim decoded PCM (24kHz 16-bit Int16) ke browser untuk playback
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(decodedPCM, { binary: true });
        }
      } catch (err) {
        // Fallback: kirim raw opus jika decode lokal gagal
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(data, { binary: true });
        }
      }
    } else {
      const text = data.toString('utf-8');
      console.log('📥 [XiaoZhi -> Browser]:', text);
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(text, { binary: false });
      }
    }
  });

  upstreamWs.on('error', (err) => {
    console.error('❌ [Proxy Upstream Error]:', err.message);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(JSON.stringify({
        type: 'alert',
        status: 'ERROR',
        message: `Upstream error: ${err.message}`
      }));
    }
  });

  upstreamWs.on('close', (code, reason) => {
    console.log(`⚠️ [Proxy Upstream Closed]: Code ${code}`);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.close();
    }
  });

  // Menerima pesan dari Browser Client
  clientWs.on('message', (data, isBinary) => {
    if (isBinary) {
      // Data biner dari browser adalah Raw PCM 16kHz (Int16)
      // Gabungkan ke buffer dan potong per 960 sample (60ms = 1920 bytes)
      pcmInputBuffer = Buffer.concat([pcmInputBuffer, data]);

      while (pcmInputBuffer.length >= FRAME_BYTES_16K) {
        const pcmFrame = pcmInputBuffer.subarray(0, FRAME_BYTES_16K);
        pcmInputBuffer = pcmInputBuffer.subarray(FRAME_BYTES_16K);

        try {
          const opusFrame = opusEncoder.encode(pcmFrame, FRAME_SAMPLES_16K);
          if (upstreamWs && upstreamWs.readyState === WebSocket.OPEN) {
            upstreamWs.send(opusFrame, { binary: true });
          }
        } catch (e) {
          console.error('❌ Error encoding Opus frame:', e.message);
        }
      }
    } else {
      const text = data.toString('utf-8');
      console.log('📤 [Browser -> XiaoZhi]:', text);

      if (text.includes('"type":"listen"') && text.includes('"state":"stop"')) {
        // Jika user stop bicara, flush sisa buffer jika ada dengan padding silence
        if (pcmInputBuffer.length > 0) {
          const padded = Buffer.alloc(FRAME_BYTES_16K);
          pcmInputBuffer.copy(padded, 0);
          pcmInputBuffer = Buffer.alloc(0);
          try {
            const opusFrame = opusEncoder.encode(padded, FRAME_SAMPLES_16K);
            if (upstreamWs && upstreamWs.readyState === WebSocket.OPEN) {
              upstreamWs.send(opusFrame, { binary: true });
            }
          } catch (e) {}
        }
      }

      if (upstreamWs && upstreamWs.readyState === WebSocket.OPEN) {
        upstreamWs.send(text, { binary: false });
      } else {
        messageQueue.push({ data: text, isBinary: false });
      }
    }
  });

  clientWs.on('close', () => {
    console.log('🔌 [Proxy] Browser client terputus.');
    if (upstreamWs && upstreamWs.readyState === WebSocket.OPEN) {
      upstreamWs.close();
    }
  });
});

server.listen(PORT, () => {
  console.log('===============================================================');
  console.log(`🌐 XiaoZhi Web Simulator berjalan di http://localhost:${PORT}`);
  console.log('===============================================================');
});
