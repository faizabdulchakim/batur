import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_FILE = path.join(__dirname, 'config.json');
const OTA_URL = 'https://api.tenclass.net/xiaozhi/ota/';

// Utility: Generate random MAC address (Espressif OUI prefix: 24:DC:C3)
function generateMacAddress() {
  const bytes = crypto.randomBytes(3);
  const suffix = Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join(':');
  return `24:dc:c3:${suffix}`;
}

// Utility: Generate Client UUID
function generateClientId() {
  return crypto.randomUUID();
}

async function requestOTA(config) {
  const payload = {
    version: 1,
    mac_address: config.mac_address,
    firmware_version: config.firmware_version || '1.0.0',
    board_type: config.board_type || 'esp32-s3-box',
    flash_size: 16777216,
    chip_model_name: 'ESP32-S3'
  };

  const response = await fetch(OTA_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Device-Id': config.mac_address,
      'Client-Id': config.client_id,
      'User-Agent': 'ESP32-HTTP-Client/1.0'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`OTA Server error: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

async function main() {
  console.log('===============================================================');
  console.log('       🤖 XIAOZHI (xiaozhi.me) DEVICE INITIALIZATION 🤖         ');
  console.log('===============================================================\n');

  let config = {};

  if (fs.existsSync(CONFIG_FILE)) {
    try {
      config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
      console.log('📂 Memuat konfigurasi perangkat lama dari config.json:');
    } catch (e) {
      console.warn('⚠️ Gagal membaca config.json, membuat konfigurasi baru...');
      config = {};
    }
  }

  if (!config.mac_address) {
    config.mac_address = generateMacAddress();
  }
  if (!config.client_id) {
    config.client_id = generateClientId();
  }
  if (!config.firmware_version) {
    config.firmware_version = '1.0.0';
  }
  if (!config.board_type) {
    config.board_type = 'esp32-s3-box';
  }

  console.log(`📌 MAC Address (Device ID) : ${config.mac_address}`);
  console.log(`📌 Client ID (UUID)        : ${config.client_id}`);
  console.log(`🌐 Menghubungi server OTA XiaoZhi: ${OTA_URL} ...\n`);

  try {
    const otaData = await requestOTA(config);

    const activationCode = otaData.activation?.code || 'N/A';
    const wsUrl = otaData.websocket?.url || 'wss://api.tenclass.net/xiaozhi/v1/';
    const wsToken = otaData.websocket?.token || 'test-token';

    config.activation_code = activationCode;
    config.ws_url = wsUrl;
    config.ws_token = wsToken;
    config.mqtt = otaData.mqtt || null;
    config.server_time = otaData.server_time || null;
    config.last_sync = new Date().toISOString();

    // Simpan ke config.json
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');

    console.log('===============================================================');
    console.log('🎉 BERHASIL MENDAPATKAN KODE AKTIVASI XIAOZHI!');
    console.log('===============================================================');
    console.log(`\n👉 KODE AKTIVASI PERANGKAT: \x1b[1m\x1b[32m[ ${activationCode} ]\x1b[0m\n`);
    console.log('===============================================================');
    console.log('📋 LANGKAH CARA PAIRING DI CONSOLE XIAOZHI:');
    console.log('  1. Buka browser: https://xiaozhi.me/');
    console.log('  2. Login / Masuk ke akun XiaoZhi Anda (atau Console).');
    console.log('  3. Klik tombol "+ Tambah Perangkat" / "+ Add Device".');
    console.log(`  4. Masukkan kode 6-digit di atas: \x1b[1m\x1b[33m${activationCode}\x1b[0m`);
    console.log('  5. Beri nama perangkat (misal: "Batur Web Simulator") dan simpan.');
    console.log('===============================================================');
    console.log('💾 Data perangkat telah disimpan ke:', CONFIG_FILE);
    console.log('\n🚀 Setelah menambahkan perangkat di https://xiaozhi.me/,');
    console.log('   Jalankan file kedua untuk mulai mengobrol:');
    console.log('   \x1b[36mnpm run chat\x1b[0m  atau  \x1b[36mnode 2_chatbot.js\x1b[0m');
    console.log('===============================================================\n');

  } catch (error) {
    console.error('❌ Gagal inisialisasi perangkat:', error.message);
  }
}

main();
