# Project BATUR - XiaoZhi ESP32 AI Assistant Memory & Context

## 📌 Ringkasan Proyek
- **Nama Proyek:** BATUR (XiaoZhi ESP32 Simulator & Hardware Voice Assistant)
- **Lokasi Proyek:** `c:\Users\user\Documents\lab\batur`
- **GitHub Repo:** `git@github.com:faizabdulchakim/batur.git` (Branch: `main`, `camera`)
- **Device ID / MAC:** `24:dc:c3:c3:18:90`
- **Client ID:** `7f556e28-5d0e-4d94-9929-04ff0ed196f7`
- **Kode Aktivasi:** `705251` (Sudah terhubung di konsol `https://xiaozhi.me/`)
- **WebSocket Protocol:** `wss://api.tenclass.net/xiaozhi/v1/` dengan protokol Opus Audio dua arah (16kHz Voice In -> 24kHz Voice Out) & MCP Vision AI.

---

## 🛠️ Arsitektur Hardware yang Dipilih (Ultra-Compact & Smart Battery)
1. **MCU:** **Seeed Studio XIAO ESP32-S3** (Ukuran mini 21x17.5mm, 8MB PSRAM, chip charger Li-Po bawaan dengan Auto Power-Path USB-C).
2. **Audio Input:** **INMP441** (Digital I2S MEMS Microphone).
   - `SCK` -> D0 (GPIO 1), `WS` -> D1 (GPIO 2), `SD` -> D2 (GPIO 3).
3. **Audio Output:** **MAX98357A** (I2S 3W Class-D DAC Amplifier) + Micro Speaker 8Ω 1W-2W.
   - `BCLK` -> D3 (GPIO 4), `LRC` -> D4 (GPIO 5), `DIN` -> D5 (GPIO 6).
4. **Indikator Visual:**
   - `LED 1 (Biru)` -> D10 (GPIO 10) - Status Mendengarkan/Berpikir.
   - `LED 2 (Hijau)` -> D9 (GPIO 9) - Status Berbicara/Online.
5. **Tombol Kontrol:** Push button di D8 (GPIO 8) untuk Push-to-Talk / Wake.
6. **Sistem Pengisian Daya (Charging):**
   - Baterai Li-Po 3.7V (500-1000mAh) tersolder ke pad `BAT+` dan `BAT-`.
   - Charging langsung colok USB-C tanpa lepas baterai (Auto Cut-off & Power-Path).
   - Sensor baterai analog dihubungkan ke pin A0 via pembagi tegangan (100k + 100k).
