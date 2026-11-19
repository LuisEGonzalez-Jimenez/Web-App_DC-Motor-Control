/*
==============================================================
Pedagogical DC Motor Control Platform - ESP32 Firmware V2.0
Authors: Luis Ricardo Rivera-Goitia, Luis Enrique González-Jiménez
ITESO – Universidad Jesuita de Guadalajara
Requires: esp32 by Espressif Systems 3.x (tested with 3.1.3)
--------------------------------------------------------------
V2.0 – Exclusively BLE (Nordic UART Service).
       Removed WiFi / MQTT / TCP / TFT touchscreen UI.
       Same JSON command schema and same 8-column CSV output.
==============================================================
*/

#include "Adafruit_INA219.h"
#include <ArduinoJson.h>
#include "esp_timer.h"
#include <Wire.h>

// === BLE ===
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

// INA219 configuration (register 0x00), same as the Adafruit library's
// (32 V, PGA /8 = 320 mV, 12-bit bus, continuous) but with averaged
// current measurement: 12 bits x 8 samples = 4.26 ms.
//   0x2000 BRNG 32V | 0x1800 PGA /8 | 0x0180 BADC 12b | 0x0058 SADC 8x | 0x0007 continuous
#define INA219_ADDR        0x40
#define INA219_CONFIG_AVG8 0x39DF

// ==========================================================
// Serial port debugging: 1 = enabled, 0 = disabled
// ==========================================================
#define DEBUG 0
#if DEBUG
  #define DBG(x)   Serial.println(x)
#else
  #define DBG(x)
#endif

// === BLE ===
// Nordic UART Service UUIDs – must match the JS client exactly.
#define BLE_SERVICE_UUID "6e400001-b5a3-f393-e0a9-e50e24dcca9e"
#define BLE_RX_UUID      "6e400002-b5a3-f393-e0a9-e50e24dcca9e"   // browser -> ESP32 (write)
#define BLE_TX_UUID      "6e400003-b5a3-f393-e0a9-e50e24dcca9e"   // ESP32 -> browser (notify)

BLEServer*         pServer  = nullptr;
BLECharacteristic* pRxChar  = nullptr;   // receives commands
BLECharacteristic* pTxChar  = nullptr;   // streams samples
bool               bleConnected   = false;
bool               bleInitialized = false;
uint16_t           bleConnId      = 0xFFFF;
String             bleRxBuffer    = "";   // accumulate until '\n'

// Current Sensor
Adafruit_INA219 ina219;

const float pi = 3.14159265358979323846;

// ==========================================================
// Pins
// ==========================================================
const int PWMA = 13;
const int AIN2 = 12, AIN1 = 14;
const int STBY = 27;

#define ENC_A 34
#define ENC_B 35
#define ENC_PPR 11
#define GEAR_BOX 44.4f
#define ENC_TIMEOUT_US 50000UL
#define ENC_MIN_PULSE_US 100UL

// ==========================================================
// Encoder (variables shared with the ISR)
// ==========================================================
volatile unsigned long t = 0;
volatile unsigned long t_m = 0;
volatile int signo = 1;
volatile int pos_i = 0;
volatile uint32_t pulseCount = 0;
portMUX_TYPE encMux = portMUX_INITIALIZER_UNLOCKED;

#define PWM_FREQ_HZ 20000

// ==========================================================
// Experiment parameters
// ==========================================================
enum Mode { MODE_NONE = 0, MODE_STEP, MODE_SINE, MODE_PID };

struct Params {
  bool  on;
  Mode  mode;
  float VCC, A, t0, offset;
  float omega, phi;
  bool  Continuous, Discrete;
  float T, N;
  double Kp, Ki, Kd;
  float des_speed;
  float omega0, omega0c;
  bool  filt, filtc;
};

Params sharedP = {};
Params P = {};
volatile uint32_t cmdSeq = 0;
portMUX_TYPE paramMux = portMUX_INITIALIZER_UNLOCKED;

// ==========================================================
// Sample queue (control task -> loop)
// ==========================================================
struct Sample {
  float  current;
  float  w;
  double time_s;
  float  Vt;
  float  w_filt;
  float  current_filt;
  int    duty;
  float  e;
};

struct LowPass { float xk1 = 0, yk1 = 0; };

QueueHandle_t sampleQueue;
#define SAMPLE_QUEUE_LEN 400
#define SEND_INTERVAL_MS 50
#define MAX_SAMPLES_PER_MSG 20

// ==========================================================
// Control task and timer
// ==========================================================
TaskHandle_t controlTaskHandle = NULL;
esp_timer_handle_t ctrlTimer = NULL;
uint32_t ctrlPeriod_us = 5000;

// ==========================================================
// Prototypes
// ==========================================================
void startBluetooth();
void parseCommand(const char* json, size_t len);
bool jsonBool(JsonVariantConst v, bool def);
void IRAM_ATTR readEncoder();
float computeSpeed();
void resetSpeedEstimator();
void controlTask(void* pv);
void onControlTimer(void* arg);
void sendPendingSamples();
void sendBleBatch(const String& batch);

// Writes the INA219 configuration register
void ina219SetAveraging() {
  Wire.beginTransmission(INA219_ADDR);
  Wire.write(0x00);
  Wire.write((uint8_t)(INA219_CONFIG_AVG8 >> 8));
  Wire.write((uint8_t)(INA219_CONFIG_AVG8 & 0xFF));
  Wire.endTransmission();
}

// ==========================================================
// SETUP
// ==========================================================
void setup() {
#if DEBUG
  Serial.begin(921600);
#else
  Serial.begin(115200);
#endif

  ina219.begin();
  ina219SetAveraging();
  ina219.getCurrent_mA();

  pinMode(ENC_A, INPUT);
  pinMode(ENC_B, INPUT);
  pinMode(PWMA, OUTPUT);
  pinMode(AIN2, OUTPUT);
  pinMode(AIN1, OUTPUT);
  pinMode(STBY, OUTPUT);

  digitalWrite(STBY, HIGH);
  digitalWrite(AIN1, LOW);
  digitalWrite(AIN2, LOW);
  analogWriteFrequency(PWMA, PWM_FREQ_HZ);
  analogWrite(PWMA, 0);

  attachInterrupt(digitalPinToInterrupt(ENC_A), readEncoder, RISING);

  sampleQueue = xQueueCreate(SAMPLE_QUEUE_LEN, sizeof(Sample));

  xTaskCreatePinnedToCore(controlTask, "control", 8192, NULL, 3, &controlTaskHandle, 1);

  esp_timer_create_args_t args = {};
  args.callback = &onControlTimer;
  args.name = "ctrl";
  esp_timer_create(&args, &ctrlTimer);
  esp_timer_start_periodic(ctrlTimer, ctrlPeriod_us);

  startBluetooth();
}

// ==========================================================
// LOOP
// ==========================================================
void loop() {
  sendPendingSamples();
  delay(1);
}

// ==========================================================
// Sending samples in batches (BLE only)
// ==========================================================
void sendPendingSamples() {
  static unsigned long lastSend = 0;
  if (millis() - lastSend < SEND_INTERVAL_MS) return;
  lastSend = millis();

  // Nobody listening: drain the queue so it doesn't overflow.
  if (!bleConnected || pTxChar == nullptr) {
    Sample drop;
    while (uxQueueMessagesWaiting(sampleQueue) > 0) {
      xQueueReceive(sampleQueue, &drop, 0);
    }
    return;
  }

  Sample s;
  while (uxQueueMessagesWaiting(sampleQueue) > 0) {
    String batch;
    batch.reserve(MAX_SAMPLES_PER_MSG * 64);
    int n = 0;

    while (n < MAX_SAMPLES_PER_MSG && xQueueReceive(sampleQueue, &s, 0) == pdTRUE) {
      batch += String(s.current) + "," + String(s.w) + "," + String(s.time_s, 6) + "," +
               String(s.Vt) + "," + String(s.w_filt) + "," + String(s.current_filt) + "," +
               String(s.duty) + "," + String(s.e) + "\n";
      n++;
    }
    if (n == 0) break;

    sendBleBatch(batch);
#if DEBUG
    Serial.print(batch);
#endif
  }
}

// === BLE ===
// Streams a CSV batch to the browser over the TX characteristic.
// Chunks at 180 B (safe under the negotiated MTU; the JS _lineBuffer
// reassembles lines transparently regardless of chunk boundaries).
void sendBleBatch(const String& batch) {
  if (!pTxChar || !bleConnected) return;
  const size_t maxChunk = 180;
  const size_t len      = batch.length();
  const char*  data     = batch.c_str();
  size_t off = 0;
  while (off < len) {
    size_t n = (len - off < maxChunk) ? (len - off) : maxChunk;
    pTxChar->setValue((uint8_t*)(data + off), n);
    pTxChar->notify();          // NOTE: returns void on ESP32 Arduino BLE
    off += n;
  }
}

// === BLE ===
// Server-side connection lifecycle.
class ServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer* srv, esp_ble_gatts_cb_param_t* param) override {
    if (param) bleConnId = param->connect.conn_id;
    bleConnected = true;
    bleRxBuffer  = "";
    DBG("BLE client connected");
  }
  void onDisconnect(BLEServer* srv) override {
    bleConnected = false;
    bleConnId    = 0xFFFF;
    bleRxBuffer  = "";
    BLEDevice::startAdvertising();   // re-advertise so the browser can reconnect
    DBG("BLE client disconnected");
  }
};

// === BLE ===
// Characteristic write handler: buffer bytes, parse one command per line.
// The JS client chunks JSON at 20 B and appends '\n', so we must reassemble
// across multiple onWrite callbacks before calling parseCommand().
class RxCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* ch) override {
    String value = ch->getValue();
    if (value.isEmpty()) return;

    for (size_t i = 0; i < value.length(); i++) {
      char c = value[i];
      if (c == '\n' || c == '\r') {
        if (bleRxBuffer.length() > 0) {
          parseCommand(bleRxBuffer.c_str(), bleRxBuffer.length());
          bleRxBuffer = "";
        }
      } else {
        bleRxBuffer += c;
        if (bleRxBuffer.length() > 1024) bleRxBuffer = "";  // safety
      }
    }
  }
};

// === BLE ===
// Creates (once) and starts the BLE peripheral.
void startBluetooth() {
  if (!bleInitialized) {
    BLEDevice::init("ESP32-MotorBLE");   // name starts with "ESP32" (browser filter)
    BLEDevice::setMTU(247);              // request a large MTU for faster streaming

    pServer = BLEDevice::createServer();
    pServer->setCallbacks(new ServerCallbacks());

    BLEService* pService = pServer->createService(BLE_SERVICE_UUID);

    pRxChar = pService->createCharacteristic(
      BLE_RX_UUID,
      BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_WRITE_NR
    );
    pRxChar->setCallbacks(new RxCallbacks());

    pTxChar = pService->createCharacteristic(
      BLE_TX_UUID,
      BLECharacteristic::PROPERTY_NOTIFY
    );
    pTxChar->addDescriptor(new BLE2902());

    pService->start();

    BLEAdvertising* pAdv = BLEDevice::getAdvertising();
    pAdv->addServiceUUID(BLE_SERVICE_UUID);
    pAdv->setScanResponse(true);
    pAdv->setMinPreferred(0x06);         // 7.5 ms

    bleInitialized = true;
  }

  BLEDevice::startAdvertising();
  DBG("BLE advertising as ESP32-MotorBLE");
}

// ==========================================================
// JSON commands (BLE only)
// ==========================================================
bool jsonBool(JsonVariantConst v, bool def) {
  if (v.isNull())     return def;
  if (v.is<bool>())   return v.as<bool>();
  if (v.is<float>())  return v.as<float>() != 0.0f;
  return def;
}

void parseCommand(const char* json, size_t len) {
  StaticJsonDocument<1024> doc;
  if (deserializeJson(doc, json, len)) return;

  const char* interruptor = doc["interruptor"];
  if (interruptor == nullptr) return;

  Params np;
  portENTER_CRITICAL(&paramMux);
  np = sharedP;
  portEXIT_CRITICAL(&paramMux);

  if (strcmp(interruptor, "off") == 0) {
    np.on = false;
  } else if (strcmp(interruptor, "on") == 0) {
    np.on = true;

    const char* typeChar = doc["Type"];
    if (typeChar != nullptr) {
      if      (strcmp(typeChar, "Step") == 0) np.mode = MODE_STEP;
      else if (strcmp(typeChar, "Sine") == 0) np.mode = MODE_SINE;
      else if (strcmp(typeChar, "PID")  == 0) np.mode = MODE_PID;
    }

    np.VCC        = doc["VCC"]        | 0.0f;
    np.A          = doc["A"]          | 0.0f;
    np.t0         = doc["t0"]         | 0.0f;
    np.offset     = doc["offset"]     | 0.0f;
    np.omega      = doc["omega"]      | 0.0f;
    np.phi        = doc["phi"]        | 0.0f;
    np.Continuous = jsonBool(doc["Continuous"], true);
    np.Discrete   = jsonBool(doc["Discrete"],   false);
    np.T          = doc["T"]          | 0.0f;
    np.N          = doc["N"]          | 0.0f;
    np.Kp         = doc["Kp"]         | 0.0;
    np.Ki         = doc["Ki"]         | 0.0;
    np.Kd         = doc["Kd"]         | 0.0;
    np.des_speed  = doc["des_speed"]  | 0.0f;
    np.omega0     = doc["omega0"]     | 0.0f;
    np.omega0c    = doc["omega0c"]    | 0.0f;
    np.filt       = jsonBool(doc["filt"],  false);
    np.filtc      = jsonBool(doc["filtc"], false);
  } else {
    return;
  }

  portENTER_CRITICAL(&paramMux);
  sharedP = np;
  cmdSeq++;
  portEXIT_CRITICAL(&paramMux);
}

// ==========================================================
// Encoder
// ==========================================================
void IRAM_ATTR readEncoder() {
  unsigned long now = micros();
  int val = digitalRead(ENC_B);

  portENTER_CRITICAL_ISR(&encMux);
  if (t != 0 && (now - t) < ENC_MIN_PULSE_US) {
    portEXIT_CRITICAL_ISR(&encMux);
    return;
  }
  t_m = t;
  t = now;
  signo = (val == LOW) ? 1 : -1;
  pos_i += (val > 0) ? -1 : 1;
  pulseCount++;
  portEXIT_CRITICAL_ISR(&encMux);
}

uint32_t      spdPrevCount = 0;
unsigned long spdPrevLast  = 0;
bool          spdValid     = false;
int           spdPrevPos   = 0;
int           spdDir       = 1;

void resetSpeedEstimator() {
  portENTER_CRITICAL(&encMux);
  spdPrevCount = pulseCount;
  spdPrevLast  = t;
  spdPrevPos   = pos_i;
  spdDir       = signo;
  portEXIT_CRITICAL(&encMux);
  spdValid = false;
}

float computeSpeed() {
  static bool spdFlipPending = false;
  unsigned long t_now, t_prev;
  uint32_t count;
  int s, pos;

  portENTER_CRITICAL(&encMux);
  t_now = t;
  t_prev = t_m;
  count = pulseCount;
  s = signo;
  pos = pos_i;
  portEXIT_CRITICAL(&encMux);

  if (t_now == 0 || (micros() - t_now) > ENC_TIMEOUT_US) {
    spdPrevCount = count;
    spdPrevLast = t_now;
    spdPrevPos = pos;
    spdDir = s;
    spdFlipPending = false;
    spdValid = false;
    return 0.0;
  }

  uint32_t dN = count - spdPrevCount;

  if (dN > 0) {
    int dPos = pos - spdPrevPos;
    int newDir = (dPos > 0) ? 1 : ((dPos < 0) ? -1 : spdDir);
    if (newDir != spdDir) {
      if (abs(dPos) >= 2 || spdFlipPending) {
        spdDir = newDir;
        spdFlipPending = false;
      } else {
        spdFlipPending = true;
      }
    } else {
      spdFlipPending = false;
    }
    spdPrevPos = pos;
  }
  float period_us = 0.0f;

  if (dN > 0 && spdValid) {
    period_us = (float)(t_now - spdPrevLast) / (float)dN;
  } else if (spdValid && t_prev != 0 && t_now != t_prev && (t_now - t_prev) <= ENC_TIMEOUT_US) {
    period_us = (float)(t_now - t_prev);
  }

  if (dN > 0) {
    spdPrevCount = count;
    spdPrevLast = t_now;
    spdValid = true;
  }

  if (period_us <= 0.0f) return 0.0;
  return (2.0f * pi * 1.0e6f * spdDir) / (period_us * ENC_PPR * GEAR_BOX);
}

// ==========================================================
// Motor
// ==========================================================
void setMotor(int duty, int pwmValue) {
  if (duty > 0) {
    digitalWrite(AIN1, HIGH);
    digitalWrite(AIN2, LOW);
    analogWrite(PWMA, pwmValue);
  } else if (duty < 0) {
    digitalWrite(AIN1, LOW);
    digitalWrite(AIN2, HIGH);
    analogWrite(PWMA, pwmValue);
  } else {
    digitalWrite(AIN1, LOW);
    digitalWrite(AIN2, LOW);
    analogWrite(PWMA, 0);
  }
}

int applyVoltage(float V, float VCC) {
  int duty = 0;
  if (VCC > 0.0f) duty = (int)((V / VCC) * 100.0f);
  duty = constrain(duty, -100, 100);
  int pwmValue = abs(map(duty, -100, 100, -255, 255));
  setMotor(duty, pwmValue);
  return duty;
}

// ==========================================================
// First-order low-pass filter (bilinear transform with prewarping)
// ==========================================================
float lowPass(LowPass& f, float x, float Ts, float f0_hz) {
  float w0 = f0_hz * 2.0f * pi;
  float denom = cos(Ts * w0);
  if (fabs(denom) < 0.0001f) denom = 0.0001f;
  float alpha = constrain((1.0f - sin(Ts * w0)) / denom, 0.0f, 0.99f);
  float a0 = (1.0f - alpha) / 2.0f;
  float y = a0 * (x + f.xk1) + alpha * f.yk1;
  f.xk1 = x;
  f.yk1 = y;
  return y;
}

// ==========================================================
// Timer -> wakes up the control task
// ==========================================================
void onControlTimer(void* arg) {
  if (controlTaskHandle) xTaskNotifyGive(controlTaskHandle);
}

void setControlPeriod(uint32_t period_us) {
  if (period_us == ctrlPeriod_us) return;
  ctrlPeriod_us = period_us;
  esp_timer_stop(ctrlTimer);
  esp_timer_start_periodic(ctrlTimer, ctrlPeriod_us);
}

// ==========================================================
// CONTROL TASK
// ==========================================================
void controlTask(void* pv) {
  uint32_t appliedSeq = 0;
  bool running = false;
  Mode runMode = MODE_NONE;

  unsigned long t_start_us = 0, prev_us = 0;
  float integral = 0, prev_e = 0, prev_derivative = 0;
  bool  pidFirst = true;
  LowPass fSpeed, fCurrent;

  for (;;) {
    ulTaskNotifyTake(pdTRUE, portMAX_DELAY);

    uint32_t seq;
    portENTER_CRITICAL(&paramMux);
    seq = cmdSeq;
    if (seq != appliedSeq) P = sharedP;
    portEXIT_CRITICAL(&paramMux);

    if (seq != appliedSeq) {
      appliedSeq = seq;

      if (!P.on) {
        running = false;
        runMode = MODE_NONE;
        applyVoltage(0.0f, 1.0f);
        setControlPeriod(5000);
        continue;
      }

      bool discreto = (P.Discrete && (P.mode == MODE_SINE || P.mode == MODE_PID));
      float Tsec = (P.T < 0.005f) ? 0.005f : P.T;
      setControlPeriod(discreto ? (uint32_t)(Tsec * 1.0e6f) : 5000);

      if (!(running && P.mode == runMode)) {
        running = true;
        runMode = P.mode;
        t_start_us = micros();
        resetSpeedEstimator();
        prev_us = t_start_us - ctrlPeriod_us;
        integral = prev_e = prev_derivative = 0;
        pidFirst = true;
        fSpeed = LowPass();
        fCurrent = LowPass();
        xQueueReset(sampleQueue);
      }
    }

    if (!running) continue;

    unsigned long now = micros();
    float Ts_nom = ctrlPeriod_us / 1.0e6f;
    float dt = (now - prev_us) / 1.0e6f;
    prev_us = now;
    if (dt <= 0.0f || dt > 2.0f * Ts_nom) dt = Ts_nom;
    double t_rel = (now - t_start_us) / 1.0e6;

    float Ts = P.Discrete ? Ts_nom : dt;

    float current = ina219.getCurrent_mA();
    float w = computeSpeed();
    float current_f = P.filtc ? lowPass(fCurrent, current, Ts, P.omega0c) : 0.0f;
    float w_f       = P.filt  ? lowPass(fSpeed,   w,       Ts, P.omega0)  : 0.0f;

    float Vt = 0.0f, e = 0.0f;
    float Vreport;

    if (runMode == MODE_STEP) {
      Vt = (t_rel < P.t0) ? P.offset : P.A + P.offset;

    } else if (runMode == MODE_SINE) {
      double tk = t_rel;
      if (P.Discrete && P.T > 0) tk = floor(t_rel / P.T) * P.T;
      Vt = P.A * sin(P.omega * tk + P.phi) + P.offset;

    } else if (runMode == MODE_PID) {
      float w_used = P.filt ? w_f : w;
      e = P.des_speed - w_used;
      if (pidFirst) {
        prev_e = e;
        pidFirst = false;
      }

      float proportional = P.Kp * e;

      float derivative;
      if (P.Discrete && P.N > 0) {
        derivative = P.Kd * P.N * (e - prev_e) + prev_derivative * (1.0f - Ts * P.N);
      } else {
        derivative = (P.Kd / Ts) * (e - prev_e);
      }

      float integral_candidate = integral + e * Ts * P.Ki;
      float Vk_unsat = proportional + integral_candidate + derivative;

      bool allowIntegration = (Vk_unsat <= 12.0f && Vk_unsat >= -12.0f) ||
                              (Vk_unsat > 12.0f && e < 0) ||
                              (Vk_unsat < -12.0f && e > 0);
      if (allowIntegration) integral = integral_candidate;

      float u = proportional + integral + derivative;
      Vt = constrain(u, -12.0f, 12.0f);
      Vreport = u;

      prev_e = e;
      prev_derivative = derivative;
    }

    if (runMode != MODE_PID) Vreport = Vt;
    int duty = applyVoltage(Vt, P.VCC);

    Sample s;
    s.current = current;
    s.w = w;
    s.time_s = t_rel;
    s.Vt = Vreport;
    s.w_filt = w_f;
    s.current_filt = current_f;
    s.duty = duty;
    s.e = e;
    xQueueSend(sampleQueue, &s, 0);
  }
}