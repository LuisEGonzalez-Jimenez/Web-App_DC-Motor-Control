/*
==============================================================
Pedagogical DC Motor Control Platform - ESP32 Firmware V2.1
Authors: Luis Ricardo Rivera-Goitia, Luis Enrique González-Jiménez
ITESO – Universidad Jesuita de Guadalajara
Requires: esp32 by Espressif Systems 3.x (tested with 3.1.3)
--------------------------------------------------------------
V2.0 – Exclusively BLE (Nordic UART Service).
       Removed WiFi / MQTT / TCP / TFT touchscreen UI.
       Same JSON command schema and same 8-column CSV output.

V2.1 – Safety hardening:
       * validateParams() rejects out-of-range JSON params before
         they reach the control loop (VCC, A, offset, omega, t0,
         T, N, Kp, Ki, Kd, des_speed, omega0, omega0c) plus
         mode-specific feasibility (|A|+|offset| <= VCC, etc.).
       * applyVoltage() clamps V to +/-VCC, rate-limits ramp-up
         (soft-start ~100 V/s), snaps to 0 V on explicit zero,
         and fails safe (0 V) on non-finite V or VCC<=0.
       * onDisconnect() forces the motor OFF on BLE link loss.
       * controlTask() floors dt at 100 us to avoid Kd/Ts blowup
         from a spurious early wakeup, and clamps the reported
         Vt to +/-VCC for Step/Sine so CSV matches duty.
==============================================================
*/

#include "Adafruit_INA219.h"
#include <ArduinoJson.h>
#include "esp_timer.h"
#include <Wire.h>
#include <math.h>

// === BLE ===
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

// INA219 configuration (register 0x00) - averaged current.
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

// Set to 1 to send "ERR:<reason>\n" over the TX characteristic
// when a command is rejected by validateParams(). Set to 0 if
// your JS CSV parser cannot tolerate non-CSV lines on TX.
#define BLE_ERROR_REPORTING 1

// === BLE ===
#define BLE_SERVICE_UUID "6e400001-b5a3-f393-e0a9-e50e24dcca9e"
#define BLE_RX_UUID      "6e400002-b5a3-f393-e0a9-e50e24dcca9e"
#define BLE_TX_UUID      "6e400003-b5a3-f393-e0a9-e50e24dcca9e"

BLEServer*         pServer  = nullptr;
BLECharacteristic* pRxChar  = nullptr;
BLECharacteristic* pTxChar  = nullptr;
bool               bleConnected   = false;
bool               bleInitialized = false;
uint16_t           bleConnId      = 0xFFFF;
String             bleRxBuffer    = "";

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
// Encoder
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

// Pending error message (sent over BLE by loop, if enabled)
static char   pendingErr[96] = "";
portMUX_TYPE  errMux = portMUX_INITIALIZER_UNLOCKED;

// ==========================================================
// Sample queue
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
const char* validateParams(const Params& p, Mode m);
void rejectCommand(const char* reason);
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

  // Send any pending rejection notice first (optional).
#if BLE_ERROR_REPORTING
  char errCopy[sizeof(pendingErr)];
  portENTER_CRITICAL(&errMux);
  memcpy(errCopy, pendingErr, sizeof(errCopy));
  pendingErr[0] = '\0';
  portEXIT_CRITICAL(&errMux);
  if (errCopy[0] != '\0' && bleConnected && pTxChar != nullptr) {
    sendBleBatch(String("ERR:") + errCopy + "\n");
  }
#endif

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

// Streams a CSV batch to the browser over the TX characteristic.
void sendBleBatch(const String& batch) {
  if (!pTxChar || !bleConnected) return;
  const size_t maxChunk = 180;
  const size_t len      = batch.length();
  const char*  data     = batch.c_str();
  size_t off = 0;
  while (off < len) {
    size_t n = (len - off < maxChunk) ? (len - off) : maxChunk;
    pTxChar->setValue((uint8_t*)(data + off), n);
    pTxChar->notify();
    off += n;
  }
}

// ==========================================================
// Server-side connection lifecycle.
// ==========================================================
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
    // FAIL-SAFE: motor off on link loss.
    portENTER_CRITICAL(&paramMux);
    sharedP.on = false;
    cmdSeq++;
    portEXIT_CRITICAL(&paramMux);
    BLEDevice::startAdvertising();
    DBG("BLE disconnected - motor forced OFF");
  }
};

// ==========================================================
// Characteristic write handler.
// ==========================================================
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

// ==========================================================
// BLE peripheral
// ==========================================================
void startBluetooth() {
  if (!bleInitialized) {
    BLEDevice::init("ESP32-MotorBLE");
    BLEDevice::setMTU(247);

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
    pAdv->setMinPreferred(0x06);

    bleInitialized = true;
  }

  BLEDevice::startAdvertising();
  DBG("BLE advertising as ESP32-MotorBLE");
}

// ==========================================================
// JSON commands
// ==========================================================
bool jsonBool(JsonVariantConst v, bool def) {
  if (v.isNull())     return def;
  if (v.is<bool>())   return v.as<bool>();
  if (v.is<float>())  return v.as<float>() != 0.0f;
  return def;
}

// Logs a rejection to Serial (if DEBUG) and queues the reason
// for transmission over BLE (if BLE_ERROR_REPORTING).
void rejectCommand(const char* reason) {
#if DEBUG
  Serial.print("REJECTED: "); Serial.println(reason);
#endif
#if BLE_ERROR_REPORTING
  portENTER_CRITICAL(&errMux);
  strncpy(pendingErr, reason, sizeof(pendingErr) - 1);
  pendingErr[sizeof(pendingErr) - 1] = '\0';
  portEXIT_CRITICAL(&errMux);
#else
  (void)reason;
#endif
}

// ==========================================================
// INPUT VALIDATION
// Rejects the whole command if any field is out of its safe
// range.  Limits chosen to allow legitimate pedagogy but
// catch obvious abuse (e.g. des_speed=5000, VCC=0.1).
// ==========================================================
const char* validateParams(const Params& p, Mode m) {
  auto inF  = [](float v,  float lo,  float hi)  {
    return isfinite(v) && v >= lo && v <= hi;
  };
  auto inD  = [](double v, double lo, double hi) {
    return isfinite((double)v) && v >= lo && v <= hi;
  };

  // Absolute field limits (generous but safe).
  if (!inF(p.VCC,      4.0f,    30.0f))    return "VCC out of range [4,30] V";
  if (!inF(p.A,       -30.0f,   30.0f))    return "A out of range [-30,30] V";
  if (!inF(p.offset,  -30.0f,   30.0f))    return "offset out of range [-30,30] V";
  if (!inF(p.omega,  -1000.0f, 1000.0f))   return "omega out of range [-1000,1000] rad/s";
  if (!inF(p.phi,    -10000.0f,10000.0f))  return "phi out of range";
  if (!inF(p.t0,       0.0f,  3600.0f))    return "t0 out of range [0,3600] s";
  if (!inF(p.N,        0.0f, 10000.0f))    return "N out of range [0,10000]";
  if (!inD(p.Kp,      -1e5,     1e5))      return "Kp out of range";
  if (!inD(p.Ki,      -1e5,     1e5))      return "Ki out of range";
  if (!inD(p.Kd,      -1e5,     1e5))      return "Kd out of range";
  if (!inF(p.des_speed, -1000.0f, 1000.0f))return "des_speed out of range [-1000,1000] rad/s";
  if (!inF(p.omega0,   0.1f,  5000.0f))    return "omega0 out of range [0.1,5000] Hz";
  if (!inF(p.omega0c,  0.1f,  5000.0f))    return "omega0c out of range [0.1,5000] Hz";

  // Discrete period (only meaningful for SINE/PID when Discrete).
  if (p.Discrete && (m == MODE_SINE || m == MODE_PID)) {
    if (!inF(p.T, 0.005f, 1.0f))
      return "Discrete T out of range [0.005,1.0] s";
  }

  // Mode-specific feasibility: keep commanded voltage within bus.
  if (m == MODE_SINE) {
    if (fabsf(p.offset) + fabsf(p.A) > p.VCC)
      return "|A| + |offset| exceeds VCC (would clip at 100% duty)";
  }
  if (m == MODE_STEP) {
    if (fabsf(p.offset) > p.VCC || fabsf(p.A + p.offset) > p.VCC)
      return "step target exceeds VCC (would clip at 100% duty)";
  }
  // PID des_speed only matters here, and the ±12V clamp handles
  // saturation, but a sanity check catches typos (e.g. 5000).
  if (m == MODE_PID && fabsf(p.des_speed) > 500.0f)
    return "des_speed implausibly high (>500 rad/s)";

  return nullptr;
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

    // ---- SAFETY GATE: reject the whole command if unsafe ----
    const char* reason = validateParams(np, np.mode);
    if (reason != nullptr) {
      rejectCommand(reason);
      return;   // keep previous parameters in effect
    }
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

// ----------------------------------------------------------
// applyVoltage: layered safety
//   1. Hard stop on V == 0 (instant stop, no ramp).
//   2. Fail-safe (0 V) on non-finite V or VCC <= 0.
//   3. Clamp target to +/-VCC (bus limit).
//   4. Rate-limit ramp-UP to ~100 V/s (soft start);
//      ramp-DOWN toward zero is unrestricted.
//   5. Clamp duty to +/-100 % before driving the H-bridge.
// ----------------------------------------------------------
int applyVoltage(float V, float VCC) {
  static float        lastV   = 0.0f;
  static unsigned long lastUs = 0;

  // (1) Explicit zero -> instant stop.
  if (V == 0.0f) {
    setMotor(0, 0);
    lastV  = 0.0f;
    lastUs = micros();
    return 0;
  }

  // (2) Fail-safe.
  if (!isfinite(V) || !isfinite(VCC) || VCC <= 0.0f) {
    setMotor(0, 0);
    lastV = 0.0f;
    return 0;
  }

  // (3) Clamp to bus.
  if (V >  VCC) V =  VCC;
  if (V < -VCC) V = -VCC;

  // (4) Soft-start rate limiter.
  unsigned long nowUs = micros();
  float dt = (nowUs - lastUs) * 1.0e-6f;
  lastUs = nowUs;
  if (dt < 0.0f || dt > 0.5f) dt = 0.005f;   // sanity

  const float maxRampV_per_s = 100.0f;
  bool towardZero = (fabsf(V) < fabsf(lastV));
  if (!towardZero) {
    float maxDelta = maxRampV_per_s * dt;
    if (V - lastV >  maxDelta) V = lastV + maxDelta;
    if (V - lastV < -maxDelta) V = lastV - maxDelta;
  }
  lastV = V;

  // (5) Duty clamp + drive.
  int duty = (int)((V / VCC) * 100.0f);
  duty = constrain(duty, -100, 100);
  int pwmValue = abs(map(duty, -100, 100, -255, 255));
  setMotor(duty, pwmValue);
  return duty;
}

// ==========================================================
// First-order low-pass filter
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
// Timer -> wakes the control task
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
        applyVoltage(0.0f, 12.0f);    // instant stop
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
    // Floor: reject spurious early wakeups (would blow up Kd/Ts).
    if (dt < 1.0e-4f || dt > 2.0f * Ts_nom) dt = Ts_nom;
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

    // For non-PID modes, clamp the reported Vt to +/-VCC so the CSV
    // column matches what the motor can actually deliver.
    if (runMode != MODE_PID) {
      Vt = constrain(Vt, -P.VCC, P.VCC);
      Vreport = Vt;
    }

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