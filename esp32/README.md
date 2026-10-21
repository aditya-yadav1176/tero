# ESP32 & OLED Display Integration Guide

Firmware scaffold and hardware preparation for the final-year engineering project: **IoT-Based Real-Time Handwriting Recognition and OLED Display**.

> **IMPORTANT NOTICE:**  
> The physical ESP32 and OLED hardware components are currently **not connected / unavailable**. This code is a **provisional firmware scaffold** built against standard ESP32 Arduino core specifications. It has **NOT** been physically tested on live hardware.

---

## 1. Hardware Specifications & Provisional Assumptions

| Component | Provisional Specification | Details to Verify When Hardware Arrives |
|-----------|---------------------------|-----------------------------------------|
| **Microcontroller** | ESP32-WROOM-32 / NodeMCU ESP32 | Confirm pinout (30-pin vs 38-pin development board) |
| **Display Module** | 0.96" Monochrome I2C OLED (128x64 pixels) | Confirm display controller IC: SSD1306 vs SH1106 |
| **Communication** | I2C Protocol | Verify module I2C address: `0x3C` (default) or `0x3D` |
| **Operating Voltage** | 3.3V Logic & Power | Verify whether display breakout board includes an onboard 5V-to-3.3V LDO regulator |

---

## 2. Provisional Circuit Wiring

Connect the OLED display to the ESP32 board using 4 jumper wires:

```
+-------------------+        +--------------------+
|  0.96" OLED I2C   |        |    ESP32 Board     |
+-------------------+        +--------------------+
| VCC               | -----> | 3.3V (or 5V if reg)|
| GND               | -----> | GND                |
| SCL               | -----> | GPIO 22 (I2C Clock)|
| SDA               | -----> | GPIO 21 (I2C Data) |
+-------------------+        +--------------------+
```

---

## 3. Required Arduino IDE Setup

1. Install [Arduino IDE](https://www.arduino.cc/en/software) (version 2.x recommended).
2. Install the **ESP32 Board Package**:
   - Go to **File > Preferences > Additional Boards Manager URLs**:
     ```
     https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
     ```
   - Go to **Tools > Board > Boards Manager**, search for `esp32` by Espressif Systems, and click **Install**.
3. Install required libraries via **Sketch > Include Library > Manage Libraries**:
   - `Adafruit GFX Library` (Adafruit)
   - `Adafruit SSD1306` (Adafruit)
   - `ArduinoJson` (Benoit Blanchon)

---

## 4. Configuration Before Flashing

Open `esp32/main.ino` and update the following settings:

```cpp
const char* WIFI_SSID     = "Your_WiFi_Network";
const char* WIFI_PASSWORD = "Your_WiFi_Password";

// Replace with your laptop's local LAN IP (e.g. run 'ipconfig' in Windows CMD)
const char* SERVER_POLL_URL = "http://192.168.1.15:8000/api/oled/message";
const char* SERVER_ACK_URL  = "http://192.168.1.15:8000/api/oled/ack";
```

---

## 5. Security & Device Authentication

- **No Root Keys:** The ESP32 firmware **never** contains Firebase Admin private keys or database superuser credentials.
- **Dedicated Device Endpoint:** The ESP32 accesses a dedicated, restricted endpoint (`/api/oled/message`) on the backend or a restricted Firestore read-only document.
- **De-duplication:** The firmware tracks `lastMessageId`. When a message arrives with the same `message_id`, it is ignored to prevent display flickering and redundant redraws.
- **Acknowledgement:** Once rendered on the OLED, the firmware issues an ACK request to mark the message as processed.

