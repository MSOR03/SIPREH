/**
 * Downsampling utilities for time series data
 * Implements LTTB (Largest Triangle Three Buckets) algorithm
 * for efficient data reduction while preserving visual fidelity
 */

/**
 * LTTB (Largest Triangle Three Buckets) downsampling algorithm
 * Reduces data points while preserving visual characteristics
 * 
 * @param {Array} data - Array of {x, y} objects
 * @param {number} threshold - Number of points to keep
 * @returns {Array} Downsampled data
 */
export function lttbDownsample(data, threshold) {
  if (!data || data.length <= threshold) {
    return data;
  }

  const sampled = [];
  const dataLength = data.length;
  
  // Always keep first point
  sampled.push(data[0]);
  
  const bucketSize = (dataLength - 2) / (threshold - 2);
  
  let a = 0; // Initially a is the first point in the triangle
  
  for (let i = 0; i < threshold - 2; i++) {
    // Calculate point average for next bucket
    let avgX = 0;
    let avgY = 0;
    
    let avgRangeStart = Math.floor((i + 1) * bucketSize) + 1;
    let avgRangeEnd = Math.floor((i + 2) * bucketSize) + 1;
    avgRangeEnd = avgRangeEnd < dataLength ? avgRangeEnd : dataLength;
    
    const avgRangeLength = avgRangeEnd - avgRangeStart;
    
    for (; avgRangeStart < avgRangeEnd; avgRangeStart++) {
      avgX += data[avgRangeStart].x;
      avgY += data[avgRangeStart].y;
    }
    avgX /= avgRangeLength;
    avgY /= avgRangeLength;
    
    // Get the range for this bucket
    let rangeOffs = Math.floor(i * bucketSize) + 1;
    const rangeTo = Math.floor((i + 1) * bucketSize) + 1;
    
    // Point a
    const pointAX = data[a].x;
    const pointAY = data[a].y;
    
    let maxArea = -1;
    let maxAreaPoint = null;
    
    for (; rangeOffs < rangeTo; rangeOffs++) {
      // Calculate triangle area over three buckets
      const area = Math.abs(
        (pointAX - avgX) * (data[rangeOffs].y - pointAY) -
        (pointAX - data[rangeOffs].x) * (avgY - pointAY)
      ) * 0.5;
      
      if (area > maxArea) {
        maxArea = area;
        maxAreaPoint = rangeOffs;
      }
    }
    
    sampled.push(data[maxAreaPoint]);
    a = maxAreaPoint;
  }
  
  // Always keep last point
  sampled.push(data[dataLength - 1]);
  
  return sampled;
}

/**
 * Simple min-max downsampling
 * Preserves min and max values in each bucket
 * 
 * @param {Array} data - Array of {x, y} objects
 * @param {number} threshold - Number of buckets
 * @returns {Array} Downsampled data
 */
export function minMaxDownsample(data, threshold) {
  if (!data || data.length <= threshold * 2) {
    return data;
  }

  const sampled = [];
  const bucketSize = Math.floor(data.length / threshold);
  
  for (let i = 0; i < threshold; i++) {
    const start = i * bucketSize;
    const end = i === threshold - 1 ? data.length : (i + 1) * bucketSize;
    
    let min = data[start];
    let max = data[start];
    
    for (let j = start; j < end; j++) {
      if (data[j].y < min.y) min = data[j];
      if (data[j].y > max.y) max = data[j];
    }
    
    // Add min and max (in x order)
    if (min.x < max.x) {
      sampled.push(min);
      if (min !== max) sampled.push(max);
    } else {
      sampled.push(max);
      if (min !== max) sampled.push(min);
    }
  }
  
  return sampled;
}

/**
 * Prepare data for charting
 * Converts various data formats to uPlot format and applies downsampling
 * 
 * @param {Array} data - Array of objects with date/value fields
 * @param {string} xKey - Key for x-axis data
 * @param {string} yKey - Key for y-axis data
 * @param {number} maxPoints - Maximum points to display (default: 5000)
 * @returns {Array} [timestamps, values] for uPlot
 */
export function prepareTimeSeriesData(data, xKey = 'date', yKey = 'value', maxPoints = 5000) {
  if (!data || data.length === 0) {
    return [[], []];
  }

  // Convert to {x, y} format
  let points = data.map(item => ({
    x: item[xKey] instanceof Date ? item[xKey].getTime() / 1000 : 
       typeof item[xKey] === 'string' ? new Date(item[xKey]).getTime() / 1000 :
       item[xKey],
    y: typeof item[yKey] === 'number' ? item[yKey] : parseFloat(item[yKey]) || 0
  }));

  // Apply downsampling if needed
  if (points.length > maxPoints) {
    points = lttbDownsample(points, maxPoints);
  }

  // Convert to uPlot format: [timestamps[], values[]]
  const timestamps = points.map(p => p.x);
  const values = points.map(p => p.y);

  return [timestamps, values];
}

/**
 * Auto-detect appropriate downsampling threshold based on container width
 * 
 * @param {number} dataLength - Number of data points
 * @param {number} containerWidth - Width of chart container in pixels
 * @returns {number} Recommended threshold
 */
export function getOptimalThreshold(dataLength, containerWidth = 1000) {
  // Aim for ~2-3 points per pixel for smooth rendering
  const pixelRatio = 2.5;
  const threshold = Math.floor(containerWidth * pixelRatio);
  
  return Math.min(dataLength, Math.max(threshold, 1000)); // Min 1000, max dataLength
}
