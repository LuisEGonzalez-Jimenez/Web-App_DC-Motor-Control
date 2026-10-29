class ESP32Console extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.port = null;
    this.reader = null;
    this.readLoopPromise = null;
    this.isReading = false;

    // Stable handler references so we can add/remove them safely
    this._onConnectClick = () => this.connect();
    this._onDisconnectClick = () => this.disconnect();
    this._onDeviceUnplug = () => this.handleDeviceUnplug();

    this.shadowRoot.innerHTML = `
      <h2>ESP32 Serial Monitor</h2>
      <button id="connectBtn" class="realtime_button">Connect</button>
      <button id="disconnectBtn" disabled class="realtime_button">Disconnect</button>
      <div id="realtime_console"></div>
    `;
  }

  connectedCallback() {
    this.connectBtn = this.shadowRoot.getElementById('connectBtn');
    this.disconnectBtn = this.shadowRoot.getElementById('disconnectBtn');
    this.outputDiv = this.shadowRoot.getElementById('realtime_console');

    this.connectBtn.addEventListener('click', this._onConnectClick);
    this.disconnectBtn.addEventListener('click', this._onDisconnectClick);

    if (!navigator.serial) {
      this.log('Error: Web Serial API not supported.');
      this.connectBtn.disabled = true;
    }
  }

  disconnectedCallback() {
    console.warn('ESP32Console: disconnecting properly');
    // Detach listeners so re-attaching doesn't duplicate them
    if (this.connectBtn) this.connectBtn.removeEventListener('click', this._onConnectClick);
    if (this.disconnectBtn) this.disconnectBtn.removeEventListener('click', this._onDisconnectClick);
    // Can't await in disconnectedCallback — fire and forget
    this.disconnect().catch(() => {});
  }

  log(msg) {
    if (!this.outputDiv) return;
    this.outputDiv.textContent += msg + '\n';
    this.outputDiv.scrollTop = this.outputDiv.scrollHeight;
  }

  async connect() {
    if (this.port || this.isReading) return; // guard against double-invoke
    this.connectBtn.disabled = true;         // lock button immediately

    try {
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: 115200 });

      this.port = port;
      this.port.addEventListener('disconnect', this._onDeviceUnplug);

      this.log('Port opened.');
      this.disconnectBtn.disabled = false;
      this.isReading = true;
      this.readLoopPromise = this.readLoop();
    } catch (err) {
      this.port = null; // reset on failure
      this.connectBtn.disabled = false;
      this.log('Error: ' + err.message);
    }
  }

  handleDeviceUnplug() {
    this.log('[DEVICE DISCONNECTED]');
    this.disconnect().catch(() => {});
  }

  async readLoop() {
    const decoder = new TextDecoder();
    let buffer = '';

    while (this.port && this.port.readable && this.isReading) {
      try {
        this.reader = this.port.readable.getReader();
        while (this.isReading) {
          const { value, done } = await this.reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop();

          for (let line of lines) {
            line = line.replace(/\r$/, '');
            if (line.length > 0) this.log(line);
          }
        }
      } catch (err) {
        if (this.isReading) this.log('[READ ERROR] ' + err.message);
      } finally {
        if (this.reader) {
          try { this.reader.releaseLock(); } catch (e) {}
          this.reader = null;
        }
      }
    }
  }

  async disconnect() {
    if (!this.isReading && !this.port) return;
    this.isReading = false;

    // 1. Wake up the pending read() so readLoop can exit
    if (this.reader) {
      try { await this.reader.cancel(); } catch (e) {}
    }

    // 2. Wait for readLoop to finish and release the reader lock
    if (this.readLoopPromise) {
      try { await this.readLoopPromise; } catch (e) {}
      this.readLoopPromise = null;
    }

    // 3. Only now is it safe to close the port
    if (this.port) {
      try { this.port.removeEventListener('disconnect', this._onDeviceUnplug); } catch (e) {}
      try { await this.port.close(); } catch (e) {}
      this.port = null;
    }

    if (this.connectBtn) {
      this.connectBtn.disabled = false;
      this.disconnectBtn.disabled = true;
    }
  }
}

customElements.define('esp32-console', ESP32Console);