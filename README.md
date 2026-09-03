# 🤖 Batur - XiaoZhi (小智 AI) Device Simulator & Chatbot

Project simulator perangkat ESP32 **XiaoZhi (xiaozhi.me)** dalam bahasa JavaScript / Node.js. Proyek ini mensimulasikan hardware ESP32 firmware XiaoZhi sehingga Anda dapat menghasilkan **Kode Aktivasi 6-Digit**, mendaftarkannya di console [xiaozhi.me](https://xiaozhi.me/), dan mengobrol secara real-time melalui protokol WebSocket XiaoZhi tanpa harus mem-flash hardware ESP32 fisik.

---

## 📁 Struktur File

```text
documents/lab/batur/
├── 1_init_device.js      # File 1: Inisialisasi MAC, UUID, dan generate 6-digit Activation Code
├── 2_chatbot.js          # File 2: Chatbot interactive CLI terkoneksi WebSocket XiaoZhi
├── config.json           # File konfigurasi yang dihasilkan otomatis (MAC, token, activation code)
├── server.js             # Web server lokal untuk Web UI Simulator
├── public/
│   └── index.html        # Antarmuka Web dengan animasi OLED Avatar ESP32 & Chat box
├── package.json          # Dependency & script shortcuts
└── README.md             # Panduan lengkap
```

---

## 🚀 Panduan Penggunaan Cepat

### 1. Inisialisasi Perangkat & Dapatkan ID / Kode Aktivasi
Jalankan file pertama untuk mensimulasikan boot firmware ESP32 dan mendapatkan kode aktivasi 6 digit dari server OTA XiaoZhi:

```bash
npm run init
# atau
node 1_init_device.js
```

**Output Terminal:**
```text
===============================================================
🎉 BERHASIL MENDAPATKAN KODE AKTIVASI XIAOZHI!
===============================================================

👉 KODE AKTIVASI PERANGKAT: [ 705251 ]

===============================================================
📋 LANGKAH CARA PAIRING DI CONSOLE XIAOZHI:
  1. Buka browser: https://xiaozhi.me/
  2. Login / Masuk ke akun XiaoZhi Anda (Console).
  3. Klik tombol "+ Tambah Perangkat" / "+ Add Device".
  4. Masukkan kode 6-digit di atas: 705251
  5. Beri nama perangkat (misal: "Batur Web Simulator") dan simpan.
===============================================================
```

Data MAC address, Client ID, dan token akan otomatis tersimpan di file `config.json`.

---

### 2. Hubungkan & Mengobrol lewat Chatbot Terminal (File 2)
Setelah perangkat ditambahkan di [https://xiaozhi.me/](https://xiaozhi.me/), jalankan file kedua:

```bash
npm run chat
# atau
node 2_chatbot.js
```

**Fitur Chatbot CLI:**
- Mengirim pesan teks pertanyaan ke server XiaoZhi.
- Menampilkan respons AI (LLM), emosi, dan status Text-to-Speech (TTS).
- Menghitung penerimaan audio Opus chunks.
- Perintah interaktif:
  - `/wake` : Mengirimkan sinyal Wake-up ("Xiao Zhi")
  - `/abort` : Menghentikan / interrupt respons AI
  - `/status`: Cek status koneksi dan ID Sesi
  - `/config`: Tampilkan detail MAC & token
  - `/exit`  : Keluar

---

### 3. (Bonus) Menggunakan Versi Web UI Simulator
Jika ingin tampilan visual dengan simulator layar OLED ESP32, jalankan web server:

```bash
npm run web
# atau
node server.js
```

Lalu buka di browser: **`http://localhost:3000`**

---

## 🛠️ Detail Protokol Teknis XiaoZhi

1. **OTA & Activation Endpoint**:
   - `POST https://api.tenclass.net/xiaozhi/ota/`
   - Headers: `Device-Id: <mac_address>`, `Client-Id: <uuid>`
   - Payload: Board type (`esp32-s3-box`), firmware version, chip model.
   - Return: `activation.code` (6-digit), `websocket.url`, `websocket.token`.

2. **WebSocket Handshake**:
   - Endpoint: `wss://api.tenclass.net/xiaozhi/v1/`
   - Headers: `Authorization: Bearer <token>`, `Device-Id: <mac>`, `Client-Id: <uuid>`, `Protocol-Version: 1`
   - Client Handshake:
     ```json
     {
       "type": "hello",
       "version": 1,
       "transport": "websocket",
       "audio_params": {
         "format": "opus",
         "sample_rate": 16000,
         "channels": 1,
         "frame_duration": 60
       }
     }
     ```
   - Server Response:
     ```json
     {
       "type": "hello",
       "version": 1,
       "transport": "websocket",
       "session_id": "xxxxxx",
       "audio_params": {
         "format": "opus",
         "sample_rate": 24000
       }
     }
     ```
