// livePlotter.js — minimal canvas line chart with a sliding window.
// Coalesces redraws via requestAnimationFrame so 20 samples arrive as 1 frame.

export class LivePlotter {
  constructor(container, title = 'Plot', maxPoints = 200) {
    if (!container) throw new Error('LivePlotter: no container');

    this.container = container;
    this.title = title;
    this.maxPoints = maxPoints;
    this.xs = [];
    this.ys = [];
    this._raf = null;
    this._mounted = false; // Tracks whether we've cleared the container yet
  }

  _mount() {
    if (this._mounted) return;
    this._mounted = true;

    // Clean up any existing Plotly instance cleanly before wiping the DOM
    if (window.Plotly) {
      try { window.Plotly.purge(this.container); } catch (e) {}
    }

    this.container.innerHTML = `
      <div style="font:12px monospace;color:#aaa;margin-bottom:2px">${this.title}</div>
      <canvas style="display:block;width:100%;height:100%"></canvas>`;
    this.canvas = this.container.querySelector('canvas');
    this.canvas.width  = this.container.clientWidth  || 400;
    this.canvas.height = this.container.clientHeight || 150;
    this.ctx = this.canvas.getContext('2d');
  }

  graphData(x, y) {
    if (!Number.isFinite(y)) return;

    // First real sample just arrived: clear previous plot and build canvas now
    if (!this._mounted) this._mount();

    this.xs.push(x);
    this.ys.push(y);
    while (this.xs.length > this.maxPoints) { this.xs.shift(); this.ys.shift(); }
    if (!this._raf) this._raf = requestAnimationFrame(() => {
      this._raf = null;
      this._draw();
    });
  }

  reset() {
    this.xs.length = 0;
    this.ys.length = 0;
    if (this._mounted) this._draw();
  }

  _draw() {
    if (!this._mounted) return;
    const { ctx, canvas } = this;
    const W = canvas.width, H = canvas.height, pad = 28;
    ctx.clearRect(0, 0, W, H);

    const n = this.ys.length;
    if (n === 0) return;

    let yMin = Math.min(...this.ys), yMax = Math.max(...this.ys);
    if (yMin === yMax) { yMin -= 1; yMax += 1; }
    const m = (yMax - yMin) * 0.1;
    yMin -= m; yMax += m;

    const xAt = i => pad + (i / Math.max(n - 1, 1)) * (W - 2 * pad);
    const yAt = v => H - pad - ((v - yMin) / (yMax - yMin)) * (H - 2 * pad);

    ctx.strokeStyle = '#444'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad, pad); ctx.lineTo(pad, H - pad); ctx.lineTo(W - pad, H - pad);
    ctx.stroke();

    ctx.strokeStyle = '#0f0'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(xAt(0), yAt(this.ys[0]));
    for (let i = 1; i < n; i++) ctx.lineTo(xAt(i), yAt(this.ys[i]));
    ctx.stroke();

    ctx.fillStyle = '#aaa'; ctx.font = '11px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(yMax.toFixed(2), pad - 4, pad + 8);
    ctx.fillText(yMin.toFixed(2), pad - 4, H - pad);
    ctx.textAlign = 'left';
    ctx.fillText(this.xs[0], pad, H - 6);
    ctx.fillText(this.xs[n - 1], W - pad - 44, H - 6);
  }
}