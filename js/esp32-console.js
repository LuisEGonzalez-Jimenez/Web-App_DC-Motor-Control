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
    this._onStartClick      = () => this.sendCommand('start');
    this._onStopClick       = () => this.sendCommand('stop');
    this._onGattDisconnect  = () => this.handleDeviceUnplug();
    this._onNotify          = (e) => this.handleNotification(e);

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; font-family: monospace; }
        button { margin: 2px; padding: 4px 10px; cursor: pointer; }
        button:disabled { cursor: not-allowed; opacity: 0.5; }
        #realtime_console {
          background: #111; color: #0f0; padding: 8px;
          height: 300px; overflow-y: auto; white-space: pre-wrap;
          border: 1px solid #333; margin-top: 8px;
        }
      </style>
      <h2>ESP32 BLE Monitor</h2>
      <button id="connectBtn">Connect</button>
      <button id="disconnectBtn" disabled>Disconnect</button>
      <button id="startBtn" disabled>Start</button>
      <button id="stopBtn"  disabled>Stop</button>
      <div id="realtime_console"></div>
    `;
  }

  connectedCallback() {
    this.connectBtn    = this.shadowRoot.getElementById('connectBtn');
    this.disconnectBtn = this.shadowRoot.getElementById('disconnectBtn');
    this.startBtn      = this.shadowRoot.getElementById('startBtn');
    this.stopBtn       = this.shadowRoot.getElementById('stopBtn');
    this.outputDiv     = this.shadowRoot.getElementById('realtime_console');

    this.connectBtn.addEventListener('click', this._onConnectClick);
    this.disconnectBtn.addEventListener('click', this._onDisconnectClick);
    this.startBtn.addEventListener('click', this._onStartClick);
    this.stopBtn.addEventListener('click', this._onStopClick);

    if (!navigator.bluetooth) {
      this.log('Error: Web Bluetooth not supported. Use Chrome or Edge.');
      this.connectBtn.disabled = true;
    }
  }

  disconnectedCallback() {
    this.connectBtn.removeEventListener('click', this._onConnectClick);
    this.disconnectBtn.removeEventListener('click', this._onDisconnectClick);
    this.startBtn.removeEventListener('click', this._onStartClick);
    this.stopBtn.removeEventListener('click', this._onStopClick);
    this.disconnect().catch(() => {});
  }

  log(msg) {
    if (!this.outputDiv) return;
    this.outputDiv.textContent += msg + '\n';
    this.outputDiv.scrollTop = this.outputDiv.scrollHeight;
  }

  async connect() {
    if (this.device || this.isReading) return;
    this.connectBtn.disabled = true;

    try {
      // 1. Ask user to pick the ESP32
      this.device = await navigator.bluetooth.requestDevice({
        filters: [{ namePrefix: 'ESP32' }],                    // matches "ESP32-BLE-Console"
        optionalServices: ['6e400001-b5a3-f393-e0a9-e50e24dcca9e']
      });

      // 2. Connect to the GATT server
      this.server = await this.device.gatt.connect();

      // 3. Grab the NUS service + both characteristics
      const service = await this.server.getPrimaryService(
        '6e400001-b5a3-f393-e0a9-e50e24dcca9e'
      );
      this.txCharacteristic = await service.getCharacteristic(
        '6e400003-b5a3-f393-e0a9-e50e24dcca9e' // notify: ESP32 -> us
      );
      this.rxCharacteristic = await service.getCharacteristic(
        '6e400002-b5a3-f393-e0a9-e50e24dcca9e' // write:  us -> ESP32
      );

      // 4. Subscribe to notifications BEFORE enabling the buttons
      this.txCharacteristic.addEventListener(
        'characteristicvaluechanged', this._onNotify
      );
      await this.txCharacteristic.startNotifications();

      // 5. Wire up disconnection and enable UI
      this.device.addEventListener('gattserverdisconnected', this._onGattDisconnect);
      this.isReading = true;

      this.log('[CONNECTED to ' + (this.device.name || 'ESP32') + ']');
      this.connectBtn.disabled    = true;
      this.disconnectBtn.disabled = false;
      this.startBtn.disabled      = false;
      this.stopBtn.disabled       = false;

    } catch (err) {
      this.log('Error: ' + err.message);
      await this.disconnect(); // clean up partial state
    }
  }

  /**
   * Write a command to the RX characteristic.
   * BLE writes are limited to ~20 bytes by default, so keep commands short.
   */
  async sendCommand(cmd) {
    if (!this.rxCharacteristic) {
      this.log('Not connected.');
      return;
    }
    try {
      const data = new TextEncoder().encode(cmd);
      // Prefer writeWithoutResponse for low-latency commands when available,
      // otherwise fall back to writeValue (acknowledged write).
      if (this.rxCharacteristic.properties.writeWithoutResponse) {
        await this.rxCharacteristic.writeValueWithoutResponse(data);
      } else {
        await this.rxCharacteristic.writeValue(data);
      }
      this.log('>> ' + cmd);
    } catch (err) {
      this.log('[WRITE ERROR] ' + err.message);
    }
  }

  /**
   * Called on every notification from the ESP32.
   * Reassembles lines because notifications can split a single line
   * across multiple BLE packets (MTU ~20 bytes by default).
   */
  handleNotification(event) {
    const value = event.target.value;
    this._lineBuffer += this._decoder.decode(value, { stream: true });

    const lines = this._lineBuffer.split('\n');
    this._lineBuffer = lines.pop(); // keep the unfinished fragment

    for (let line of lines) {
      line = line.replace(/\r$/, '');
      if (line.length > 0) this.log(line);
    }
  }

  handleDeviceUnplug() {
    this.log('[DEVICE DISCONNECTED]');
    this.disconnect().catch(() => {});
  }

  async disconnect() {
    if (!this.device && !this.isReading) return;
    this.isReading = false;

    // 1. Stop notifications on TX
    if (this.txCharacteristic) {
      try { this.txCharacteristic.removeEventListener(
              'characteristicvaluechanged', this._onNotify); } catch (e) {}
      try { await this.txCharacteristic.stopNotifications(); } catch (e) {}
    }

    // 2. Drop the GATT connection
    if (this.device) {
      try { this.device.removeEventListener(
              'gattserverdisconnected', this._onGattDisconnect); } catch (e) {}
      if (this.device.gatt.connected) {
        try { this.device.gatt.disconnect(); } catch (e) {}
      }
    }

    // 3. Reset state
    this.device           = null;
    this.server           = null;
    this.txCharacteristic = null;
    this.rxCharacteristic = null;
    this._lineBuffer      = '';

    // 4. Reset UI
    if (this.connectBtn) {
      this.connectBtn.disabled    = false;
      this.disconnectBtn.disabled = true;
      this.startBtn.disabled      = true;
      this.stopBtn.disabled       = true;
    }
  }
}

customElements.define('esp32-console', ESP32Console);