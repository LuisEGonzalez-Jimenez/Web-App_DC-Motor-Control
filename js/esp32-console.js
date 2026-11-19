import { LivePlotter } from './livePlotter.js';

class ESP32Console extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    this.device = null;
    this.server = null;
    this.txCharacteristic = null; // ESP32 -> browser (notify)
    this.rxCharacteristic = null; // browser -> ESP32 (write)

    this.isReading = false;
    this._lineBuffer = '';        // reassemble lines split across BLE packets
    this._decoder = new TextDecoder();

    // Stable handler references
    this._onConnectClick    = () => this.connect();
    this._onDisconnectClick = () => this.disconnect();
    this._onGattDisconnect  = () => this.handleDeviceUnplug();
    this._onNotify          = (e) => this.handleNotification(e);
    this._sendChain = Promise.resolve();   // serialize concurrent sends

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; font-family: monospace; }
        button { margin: 2px; padding: 4px 10px; cursor: pointer; }
        button:disabled { cursor: not-allowed; opacity: 0.5; }
        #status { font-weight: bold; color: #888; margin-left: 6px; }
        #realtime_console {
          background: #111; color: #0f0; padding: 8px;
          height: 200px; overflow-y: auto; white-space: pre-wrap;
          border: 1px solid #333; margin-top: 8px;
        }
      </style>
      <h2>ESP32 BLE Monitor</h2>
      <button id="connectBtn">Connect</button>
      <button id="disconnectBtn" disabled>Disconnect</button>
      <div id="realtime_console"></div>
    `;
  }

  /* ---------- public API used by the rest of the app ---------- */

  get connected() {
    return !!(this.device && this.device.gatt &&
              this.device.gatt.connected && this.rxCharacteristic);
  }

  log(msg) {
    if (!this.outputDiv) return;
    this.outputDiv.textContent += msg + '\n';
    this.outputDiv.scrollTop = this.outputDiv.scrollHeight;
  }

  /**
   * Send a command to the ESP32.
   * Accepts a JSON string or a plain object. Examples:
   *   esp.sendCommand({interruptor:"off"});
   *   esp.sendCommand({interruptor:"on",Type:"Step",VCC:12,A:6,t0:1.0,offset:0});
   *   esp.sendCommand({interruptor:"on",Type:"Sine",VCC:12,A:3,omega:6.283,
   *                    phi:0,offset:0,Discrete:true,T:0.01});
   *   esp.sendCommand({interruptor:"on",Type:"PID",VCC:12,Kp:2,Ki:5,Kd:0.01,
   *                    des_speed:20,filt:true,omega0:50});
   * Chunks into MTU-safe writes (20 B) and appends '\n' so the ESP32 can
   * buffer until end-of-command before parsing.
   * @returns {Promise<boolean>} true on success
   */
  async sendCommand(cmd) {
    if (!this.rxCharacteristic || !this.connected) {
      this.log('Not connected.');
      return false;
    }
    const text  = (typeof cmd === 'string') ? cmd : JSON.stringify(cmd);
    const bytes = new TextEncoder().encode(text + '\n');
    const CHUNK = 20;
    const run = async () => {
      try {
        for (let i = 0; i < bytes.length; i += CHUNK) {
          await this.rxCharacteristic.writeValue(bytes.slice(i, i + CHUNK));
        }
        this.log('>> ' + text);
        return true;
      } catch (err) {
        this.log('[WRITE ERROR] ' + err.message);
        return false;
      }
    };
    this._sendChain = this._sendChain.then(run, run);
    return this._sendChain
  }

  /* ---------- lifecycle ---------- */

  connectedCallback() {
    this.connectBtn    = this.shadowRoot.getElementById('connectBtn');
    this.disconnectBtn = this.shadowRoot.getElementById('disconnectBtn');
    this.outputDiv     = this.shadowRoot.getElementById('realtime_console');
    this.statusSpan    = this.shadowRoot.getElementById('status');

    this.connectBtn.addEventListener('click', this._onConnectClick);
    this.disconnectBtn.addEventListener('click', this._onDisconnectClick);

    if (!navigator.bluetooth) {
      this.log('Error: Web Bluetooth not supported. Use Chrome or Edge.');
      this.connectBtn.disabled = true;
    }
  }

  disconnectedCallback() {
    this.connectBtn?.removeEventListener('click', this._onConnectClick);
    this.disconnectBtn?.removeEventListener('click', this._onDisconnectClick);
    this.disconnect().catch(() => {});
  }

  async connect() {
    if (this.device || this.isReading) return;
    this.connectBtn.disabled = true;

    try {
      this.device = await navigator.bluetooth.requestDevice({
        filters: [{ namePrefix: 'ESP32' }],
        optionalServices: ['6e400001-b5a3-f393-e0a9-e50e24dcca9e']
      });

      this.server = await this.device.gatt.connect();

      const service = await this.server.getPrimaryService(
        '6e400001-b5a3-f393-e0a9-e50e24dcca9e'
      );
      this.txCharacteristic = await service.getCharacteristic(
        '6e400003-b5a3-f393-e0a9-e50e24dcca9e' // notify: ESP32 -> us
      );
      this.rxCharacteristic = await service.getCharacteristic(
        '6e400002-b5a3-f393-e0a9-e50e24dcca9e' // write:  us -> ESP32
      );

      this.txCharacteristic.addEventListener(
        'characteristicvaluechanged', this._onNotify
      );
      await this.txCharacteristic.startNotifications();

      this.device.addEventListener('gattserverdisconnected', this._onGattDisconnect);
      this.isReading = true;

      this.log('[CONNECTED to ' + (this.device.name || 'ESP32') + ']');
      this._setStatus('connected', 'green');
      this.connectBtn.disabled    = true;
      this.disconnectBtn.disabled = false;

      this.dispatchEvent(new CustomEvent('connectionchange',
        { detail: { connected: true } }));

    } catch (err) {
      this.log('Error: ' + err.message);
      this._setStatus('disconnected', 'red');
      await this.disconnect();
    }
  }

  async disconnect() {
    if (!this.device && !this.isReading) return;
    this.isReading = false;

    if (this.txCharacteristic) {
      try {
        this.txCharacteristic.removeEventListener(
          'characteristicvaluechanged', this._onNotify);
      } catch (e) {}
      try { await this.txCharacteristic.stopNotifications(); } catch (e) {}
    }

    if (this.device) {
      try {
        this.device.removeEventListener(
          'gattserverdisconnected', this._onGattDisconnect);
      } catch (e) {}
      if (this.device.gatt.connected) {
        try { this.device.gatt.disconnect(); } catch (e) {}
      }
    }

    this.device = null;
    this.server = null;
    this.txCharacteristic = null;
    this.rxCharacteristic = null;
    this._lineBuffer = '';

    if (this.connectBtn) {
      this.connectBtn.disabled    = false;
      this.disconnectBtn.disabled = true;
    }
    this._setStatus('disconnected', 'red');

    this.dispatchEvent(new CustomEvent('connectionchange',
      { detail: { connected: false } }));
  }

  /* ---------- incoming data ---------- */

  /**
   * The ESP32 streams CSV batches. One sample per line:
   *   current_mA,w_rad_s,time_s,Vt,w_filt,current_filt,duty,e\n
   * A single line can be split across BLE notifications, so we
   * keep a line buffer and only emit complete lines.
   */
  handleNotification(event) {
    this._lineBuffer += this._decoder.decode(event.target.value, { stream: true });

    const lines = this._lineBuffer.split('\n');
    this._lineBuffer = lines.pop(); // incomplete tail

    for (let line of lines) {
      line = line.replace(/\r$/, '').trim();
      if (!line) continue;

      this.log(line);

      const sample = this._parseSample(line);
      if (!sample) continue;

      this.dispatchEvent(new CustomEvent('sample', { detail: sample }));
    }
  }

  _parseSample(line) {
    const parts = line.split(',');
    if (parts.length < 8) return null;
    const nums = parts.slice(0, 8).map(Number);
    if (nums.some(isNaN)) return null;
    const [current, w, time_s, Vt, w_filt, current_filt, duty, e] = nums;
    return { current, w, time_s, Vt, w_filt, current_filt, duty, e };
  }

  handleDeviceUnplug() {
    this.log('[DEVICE DISCONNECTED]');
    this._setStatus('disconnected', 'red');
    this.disconnect().catch(() => {});
  }

  _setStatus(text, color) {
    if (this.statusSpan) {
      this.statusSpan.textContent = text;
      this.statusSpan.style.color = color;
    }

    // Update external status circle & text in the main DOM
    const svgPath = document.getElementById('statusCircleId');
    if (svgPath) {
      svgPath.setAttribute('fill', color); // 'green' on connect, 'red' on disconnect
    }

    const statusText = document.getElementById('statusTextId');
    if (statusText) {
      statusText.textContent = (text === 'connected') ? '  System On' : '  System Off';
    }
  }
}

customElements.define('esp32-console', ESP32Console);