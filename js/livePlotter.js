// livePlotter.js
import Chart from 'https://cdn.jsdelivr.net/npm/chart.js/auto/+esm';

export class LivePlotter {
  constructor(containerElement, label = 'Live Data', maxPoints = 100) {
    this.container = containerElement;
    this.label = label;
    this.maxPoints = maxPoints;
    this.chart = null;
  }

  graphData(xValue, yValue) {
    // 1. FIRST CALL: Initialize canvas and chart
    if (!this.chart) {
      const canvas = document.createElement('canvas');
      this.container.innerHTML = '';
      this.container.appendChild(canvas);

      this.chart = new Chart(canvas, {
        type: 'line',
        data: {
          labels: [xValue],
          datasets: [{
            label: this.label,
            data: [yValue],
            borderColor: '#00ff00', // Matches your terminal aesthetic
            backgroundColor: 'rgba(0, 255, 0, 0.1)',
            borderWidth: 2,
            pointRadius: 0, // Hides dots for smoother 10Hz waveforms
            tension: 0.2,
            fill: false
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false, // Best for 10Hz+ live telemetry
          scales: {
            x: { ticks: { maxTicksLimit: 8 } },
            y: { beginAtZero: true }
          }
        }
      });
      return;
    }

    // 2. SUBSEQUENT CALLS: Append and update
    this.chart.data.labels.push(xValue);
    this.chart.data.datasets[0].data.push(yValue);


    // if i ever want to make the data shift to the left here is the code.
    // if (this.chart.data.labels.length > this.maxPoints) {
    //   this.chart.data.labels.shift();
    //   this.chart.data.datasets[0].data.shift();
    // }

    this.chart.update('none');
  }

  reset() {
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
  }
}