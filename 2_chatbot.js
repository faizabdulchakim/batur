import fs from 'fs';
import path from 'path';
import readline from 'readline';
import WebSocket from 'ws';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_FILE = path.join(__dirname, 'config.json');

// Check config
if (!fs.existsSync(CONFIG_FILE)) {
  console.error('❌ File config.json belum ditemukan!');
  console.error('👉 Silakan jalankan inisialisasi terlebih dahulu:');
  console.error('   npm run init   atau   node 1_init_device.js\n');
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));

console.log('===============================================================');
console.log('       🤖 XIAOZHI (xiaozhi.me) CHATBOT CLIENT SIMULATOR 🤖       ');
console.log('===============================================================');
console.log(`📌 Device MAC   : ${config.mac_address}`);
console.log(`📌 Client ID    : ${config.client_id}`);
console.log(`📌 Token        : ${config.ws_token || 'test-token'}`);
console.log(`🌐 Server WS    : ${config.ws_url || 'wss://api.tenclass.net/xiaozhi/v1/'}`);
console.log('===============================================================\n');

const wsUrl = config.ws_url || 'wss://api.tenclass.net/xiaozhi/v1/';
let ws = null;
let currentSessionId = null;
let isListening = false;
let audioFramesCount = 0;
let rl = null;

function setupReadline() {
  if (rl) rl.close();

  rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '\x1b[32mKamu > \x1b[0m'
  });

  rl.on('line', (line) => {
    const text = line.trim();
    if (!text) {
      rl.prompt();
      return;
    }

    if (text.startsWith('/')) {
      handleCommand(text);
    } else {
      sendUserInput(text);
    }
  });

  rl.on('close', () => {
    console.log('\n👋 Menutup koneksi XiaoZhi Chatbot...');
    if (ws) ws.close();
    process.exit(0);
  });
}

function handleCommand(cmd) {
  const parts = cmd.split(' ');
  const action = parts[0].toLowerCase();

  switch (action) {
    case '/help':
      console.log('\n📖 DAFTAR PERINTAH:');
      console.log('  /wake             - Trigger wake word ("Xiao Zhi")');
      console.log('  /abort            - Menghentikan/interrupt respons AI');
      console.log('  /status           - Cek status sesi WebSocket saat ini');
      console.log('  /config           - Tampilkan info perangkat');
      console.log('  /exit             - Keluar dari program');
      console.log('  <ketik apa saja>  - Kirim teks pertanyaan ke AI\n');
      break;

    case '/wake':
      if (ws && ws.readyState === WebSocket.OPEN) {
        console.log('🔔 [Device] Mengirimkan Wake Word trigger...');
        ws.send(JSON.stringify({
          type: 'listen',
          state: 'detect',
          text: 'xiaozhi'
        }));
      } else {
        console.log('⚠️ WebSocket belum terhubung.');
      }
      break;

    case '/abort':
      if (ws && ws.readyState === WebSocket.OPEN) {
        console.log('🛑 [Device] Mengirimkan Abort / Interruption...');
        ws.send(JSON.stringify({
          type: 'abort',
          session_id: currentSessionId
        }));
      }
      break;

    case '/status':
      console.log('\n📊 STATUS KONEKSI:');
      console.log(`  State      : ${ws ? ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'][ws.readyState] : 'NULL'}`);
      console.log(`  Session ID : ${currentSessionId || 'Belum ada'}`);
      console.log(`  Audio Rx   : ${audioFramesCount} frames diterima\n`);
      break;

    case '/config':
      console.log('\n⚙️ KONFIGURASI PERANGKAT:');
      console.log(JSON.stringify(config, null, 2), '\n');
      break;

    case '/exit':
    case '/quit':
      rl.close();
      return;

    default:
      console.log(`⚠️ Perintah tidak dikenal: ${cmd}. Ketik /help untuk bantuan.`);
      break;
  }
  rl.prompt();
}

function sendUserInput(text) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    console.log('⚠️ Belum terhubung ke server XiaoZhi. Mohon tunggu sebentar...');
    rl.prompt();
    return;
  }

  console.log(`\x1b[90m[Mengirim pertanyaan ke XiaoZhi...]\x1b[0m`);

  // 1. Abort previous stream jika ada
  ws.send(JSON.stringify({
    type: 'abort',
    session_id: currentSessionId
  }));

  // 2. Trigger wake word
  ws.send(JSON.stringify({
    type: 'listen',
    state: 'detect',
    text: 'xiaozhi'
  }));

  // 3. Start listen dan kirim teks pertanyaan
  setTimeout(() => {
    ws.send(JSON.stringify({
      type: 'listen',
      state: 'start',
      mode: 'manual'
    }));

    setTimeout(() => {
      ws.send(JSON.stringify({
        type: 'listen',
        state: 'stop',
        text: text
      }));
    }, 150);
  }, 100);
}

function connect() {
  console.log(`🔄 Menghubungkan ke server WebSocket XiaoZhi: ${wsUrl} ...`);

  ws = new WebSocket(wsUrl, {
    headers: {
      'Authorization': `Bearer ${config.ws_token || 'test-token'}`,
      'Protocol-Version': '1',
      'Device-Id': config.mac_address,
      'Client-Id': config.client_id
    }
  });

  ws.on('open', () => {
    console.log('✅ WebSocket Terhubung ke XiaoZhi Server!');

    // Kirim Hello Handshake
    const helloPayload = {
      type: 'hello',
      version: 1,
      features: {
        mcp: true,
        aec: true
      },
      transport: 'websocket',
      audio_params: {
        format: 'opus',
        sample_rate: 16000,
        channels: 1,
        frame_duration: 60
      }
    };

    ws.send(JSON.stringify(helloPayload));
    console.log('📤 Handshake `hello` terkirim.');
  });

  ws.on('message', (data, isBinary) => {
    if (isBinary) {
      audioFramesCount++;
      // Data audio Opus dari TTS server
      process.stdout.write(`\r\x1b[35m[🔊 Audio Opus Chunks: ${audioFramesCount} frames received]\x1b[0m`);
      return;
    }

    try {
      const msg = JSON.parse(data.toString());
      handleServerMessage(msg);
    } catch (e) {
      console.log('\n[Raw Text]:', data.toString());
    }
  });

  ws.on('error', (err) => {
    console.error('\n❌ WebSocket Error:', err.message);
  });

  ws.on('close', (code, reason) => {
    console.log(`\n⚠️ Koneksi ditutup (Code: ${code}, Reason: ${reason || 'None'})`);
    console.log('🔄 Menghubungkan kembali dalam 5 detik...');
    setTimeout(connect, 5000);
  });
}

function handleServerMessage(msg) {
  const type = msg.type;

  switch (type) {
    case 'hello':
      currentSessionId = msg.session_id;
      console.log(`\n🎉 Handshake Sukses! Session ID: \x1b[36m${currentSessionId}\x1b[0m`);
      if (msg.audio_params) {
        console.log(`🎚️ Audio Format: ${msg.audio_params.format}, Sample Rate: ${msg.audio_params.sample_rate}Hz`);
      }
      console.log('\n💬 Siap mengobrol! Ketik pertanyaan Anda di bawah (atau /help):');
      setupReadline();
      rl.prompt();
      break;

    case 'stt':
      console.log(`\n\x1b[34m🎤 [STT User]:\x1b[0m ${msg.text}`);
      if (rl) rl.prompt();
      break;

    case 'llm':
      if (msg.text) {
        const emotion = msg.emotion ? `[${msg.emotion}] ` : '';
        console.log(`\n\x1b[32m🤖 XiaoZhi ${emotion}:\x1b[0m ${msg.text}`);
      }
      if (rl) rl.prompt();
      break;

    case 'tts':
      if (msg.state === 'start') {
        audioFramesCount = 0;
        console.log(`\n\x1b[33m🗣️ [XiaoZhi Mulai Berbicara...]\x1b[0m`);
      } else if (msg.state === 'sentence_start' && msg.text) {
        console.log(`\x1b[32m🤖 XiaoZhi:\x1b[0m ${msg.text}`);
      } else if (msg.state === 'stop') {
        console.log(`\n\x1b[33m⏹️ [XiaoZhi Selesai Berbicara]\x1b[0m`);
      }
      if (rl) rl.prompt();
      break;

    case 'alert':
      const emotion = msg.emotion ? `(${msg.emotion})` : '';
      console.log(`\n\x1b[31m⚠️ [Alert ${msg.status || ''} ${emotion}]:\x1b[0m ${msg.message}`);
      if (rl) rl.prompt();
      break;

    case 'mcp':
      console.log(`\n\x1b[36m🛠️ [MCP Tool Call]:\x1b[0m`, JSON.stringify(msg));
      if (rl) rl.prompt();
      break;

    default:
      console.log(`\n[Pesan Server (${type})]:`, JSON.stringify(msg));
      if (rl) rl.prompt();
      break;
  }
}

// Mulai koneksi
connect();
