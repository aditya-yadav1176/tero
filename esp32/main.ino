/*
 * ============================================================================
 * Project: IoT-Based Real-Time Handwriting Recognition and OLED Display
 * Device: ESP32 Microcontroller + I2C OLED Display
 * File: main.ino
 * ============================================================================
 *
 * STATUS: PROVISIONAL FIRMWARE SCAFFOLD
 * NOTE: The ESP32 and OLED hardware are not currently physically connected.
 * This firmware is written against standard ESP32 Arduino core specifications
 * and provisional SSD1306 I2C specifications. Physical validation is required
 * once the hardware components arrive.
 *
 * PROVISIONAL HARDWARE ASSUMPTIONS:
 * - Microcontroller: ESP32 NodeMCU / WROOM-32 (38-pin or 30-pin)
 * - Display: 0.96 inch SSD1306 Monochrome OLED (128x64 pixels)
 * - Communication Protocol: I2C (Wire library)
 * - Default I2C Address: 0x3C (some modules use 0x3D)
 * - Pinout:
 *     SDA -> GPIO 21 (ESP32 default I2C Data)
 *     SCL -> GPIO 22 (ESP32 default I2C Clock)
 *     VCC -> 3.3V (Check if module requires 3.3V or 5V)
 *     GND -> Ground
 *
 * REQUIRED ARDUINO LIBRARIES:
 * 1. Adafruit_GFX (Version >= 1.11.0)
 * 2. Adafruit_SSD1306 (Version >= 2.5.7)
 * 3. ArduinoJson (Version >= 6.21.0 or 7.x)
 * 4. WiFi / HTTPClient (Built into ESP32 Arduino Core)
 * ============================================================================
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <ArduinoJson.h>

// --- Configuration ---
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// Server endpoint for polling OLED display text.
// Replace with your laptop's local IP address (e.g. "http://192.168.1.15:8000/api/oled/message")
// or production cloud endpoint.
const char* SERVER_POLL_URL = "http://192.168.1.100:8000/api/oled/message";
const char* SERVER_ACK_URL  = "http://192.168.1.100:8000/api/oled/ack";

// Device API key for basic authentication
const char* DEVICE_API_KEY  = "esp32_secret_demo_key";

// Polling interval in milliseconds
const unsigned long POLL_INTERVAL_MS = 3000;

// OLED Display Parameters
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET    -1     // Reset pin # (or -1 if sharing ESP32 reset pin)
#define SCREEN_I2C_ADDR 0x3C // Provisional I2C address (0x3C or 0x3D)

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// State tracking
String lastMessageId = "";
unsigned long lastPollTime = 0;


// --- Helper: Render Text on OLED ---
void renderDisplayMessage(const String& title, const String& body, bool isNew = false) {
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);

  // Header Banner
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.print(F("[TERO OLED] "));
  if (WiFi.status() == WL_CONNECTED) {
    display.print(F("WiFi:OK"));
  } else {
    display.print(F("WiFi:OFF"));
  }

  // Divider line
  display.drawLine(0, 10, SCREEN_WIDTH - 1, 10, SSD1306_WHITE);

  // Subtitle / Label
  display.setTextSize(1);
  display.setCursor(0, 14);
  display.print(title);

  // Main Recognition Body Text (Size 2 for readability)
  display.setTextSize(2);
  display.setCursor(0, 28);
  display.setTextWrap(true);

  if (body.length() > 0) {
    display.print(body);
  } else {
    display.setTextSize(1);
    display.print(F("No text available"));
  }

  // New message indicator dot
  if (isNew) {
    display.fillCircle(SCREEN_WIDTH - 5, 5, 2, SSD1306_WHITE);
  }

  display.display();
}


// --- Helper: Manage Wi-Fi Connection with Auto-Reconnect ---
void ensureWiFiConnected() {
  if (WiFi.status() == WL_CONNECTED) {
    return;
  }

  Serial.println(F("[WiFi] Connecting to Wi-Fi network..."));
  renderDisplayMessage(F("Connecting WiFi..."), String(WIFI_SSID));

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(F("."));
    attempts++;
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.print(F("[WiFi] Connected! IP Address: "));
    Serial.println(WiFi.localIP());
    renderDisplayMessage(F("WiFi Connected"), WiFi.localIP().toString());
    delay(1500);
    renderDisplayMessage(F("Status: Ready"), F("Waiting for drawing..."));
  } else {
    Serial.println(F("[WiFi] Connection failed. Will retry next cycle."));
    renderDisplayMessage(F("WiFi Error"), F("Check credentials"));
  }
}


// --- Setup Routine ---
void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println(F("\n========================================"));
  Serial.println(F(" Tero ESP32 OLED Handwriting Node"));
  Serial.println(F("========================================"));

  // Initialize I2C communication (GPIO 21 SDA, GPIO 22 SCL)
  Wire.begin(21, 22);

  // Initialize SSD1306 display
  if (!display.begin(SSD1306_SWITCHCAPVCC, SCREEN_I2C_ADDR)) {
    Serial.println(F("[ERROR] SSD1306 allocation failed. Check wiring and I2C address (0x3C vs 0x3D)."));
    // Note: Do not halt completely so serial debugging continues
  } else {
    Serial.println(F("[OLED] Display initialized successfully."));
    display.clearDisplay();
    renderDisplayMessage(F("Initializing..."), F("Booting up"));
  }

  ensureWiFiConnected();
}


// --- Poll Server for New Handwriting Messages ---
void pollServerForNewMessage() {
  if (WiFi.status() != WL_CONNECTED) {
    return;
  }

  HTTPClient http;
  http.begin(SERVER_POLL_URL);
  http.addHeader("X-API-Key", DEVICE_API_KEY);
  http.setTimeout(3500);

  int httpCode = http.GET();
  if (httpCode == HTTP_CODE_OK) {
    String payload = http.getString();
    // Parse JSON response
    DynamicJsonDocument doc(1024);
    DeserializationError error = deserializeJson(doc, payload);

    if (!error) {
      String messageId = doc["message_id"].as<String>();
      String text = doc["text"].as<String>();
      bool isNew = doc["is_new"].as<bool>();

      // Check whether this message is new or has changed
      if (messageId != lastMessageId && messageId.length() > 0) {
        Serial.printf("[OLED] New message received! ID: %s | Text: '%s'\n", messageId.c_str(), text.c_str());
        lastMessageId = messageId;

        // Display on OLED
        renderDisplayMessage(F("Recognized:"), text, true);

        // Send acknowledgement back to server
        http.end();
        HTTPClient ackHttp;
        String ackUrl = String(SERVER_ACK_URL) + "?message_id=" + messageId;
        ackHttp.begin(ackUrl);
        ackHttp.POST("");
        ackHttp.end();
        return;
      }
    } else {
      Serial.printf("[OLED] JSON parse error: %s\n", error.c_str());
    }
  } else {
    Serial.printf("[OLED] HTTP poll error code: %d\n", httpCode);
  }

  http.end();
}


// --- Main Loop ---
void loop() {
  ensureWiFiConnected();

  unsigned long currentMillis = millis();
  if (currentMillis - lastPollTime >= POLL_INTERVAL_MS) {
    lastPollTime = currentMillis;
    pollServerForNewMessage();
  }

  delay(50);
}

