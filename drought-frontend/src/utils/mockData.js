// utility for generating realistic time series mock data
// includes seasonal cycle and noise

/**
 * Generate time series data spanning a number of years.
 *
 * @param {object} opts
 * @param {Date|string} [opts.start]  - start date (defaults to now minus years)
 * @param {number} [opts.years=30]    - number of years
 * @param {number} [opts.amplitude=1] - seasonal amplitude
 * @param {number} [opts.noiseLevel=0.2] - standard deviation of gaussian noise
 * @param {"daily"|"monthly"} [opts.freq="daily"] - sampling frequency
 * @returns {Array<{date:Date,value:number}>}
 */
export function generateMockSeries({ start, years = 30, amplitude = 1, noiseLevel = 0.2, freq = 'daily' } = {}) {
  const results = [];
  const msPerDay = 24 * 60 * 60 * 1000;
  const startDate = start ? new Date(start) : new Date(Date.now() - years * 365 * msPerDay);
  const end = new Date(startDate);
  end.setFullYear(end.getFullYear() + years);

  let current = new Date(startDate);
  while (current < end) {
    const t = (current - startDate) / msPerDay; // days since start
    const season = amplitude * Math.sin((2 * Math.PI * t) / 365);
    const noise = randn_bm() * noiseLevel;
    results.push({ date: new Date(current), value: season + noise });

    if (freq === 'monthly') {
      current.setMonth(current.getMonth() + 1);
    } else {
      current.setDate(current.getDate() + 1);
    }
  }
  return results;
}

// Box-Muller gaussian
function randn_bm() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}
