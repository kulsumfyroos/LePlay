/**
 * analytics.js – Analytics Dashboard for LePlay
 * 
 * This script handles fetching and displaying historical analytics data
 * from three API endpoints:
 * 1. Average Wait Times
 * 2. Missed Rides
 * 3. Average Ride Duration
 */

// API Base URL - update this to match your backend
const API_BASE_URL = "https://www.foreverkid.in/api/v1/metrics";


// DOM Elements
let startDatePicker;
let endDatePicker;

document.addEventListener('DOMContentLoaded', () => {
  // Initialize date pickers
  const today = new Date();
  
  startDatePicker = flatpickr('#startDate', {
    dateFormat: 'Y-m-d',
    defaultDate: today,
    maxDate: today
  });
  
  endDatePicker = flatpickr('#endDate', {
    dateFormat: 'Y-m-d',
    defaultDate: today,
    maxDate: today
  });
  
  // Fetch data button
  document.getElementById('fetchDataBtn').addEventListener('click', fetchAllMetrics);
});

/**
 * Fetch all three metrics and update the UI
 */
async function fetchAllMetrics() {
  const startDate = startDatePicker.selectedDates[0] 
    ? formatDate(startDatePicker.selectedDates[0]) 
    : '';
  const endDate = endDatePicker.selectedDates[0] 
    ? formatDate(endDatePicker.selectedDates[0]) 
    : '';
  
  // Clear error message
  hideError();
  
  // Show loading states
  showLoading('waitTimesContent');
  showLoading('missedRidesContent');
  showLoading('rideDurationContent');
  
  // Fetch all metrics in parallel
  try {
    const [waitTimes, missedRides, rideDuration] = await Promise.all([
      fetchAverageWaitTimes(startDate, endDate),
      fetchMissedRides(startDate, endDate),
      fetchAverageRideDuration(startDate, endDate)
    ]);
    
    // Render each metric
    renderAverageWaitTimes(waitTimes);
    renderMissedRides(missedRides);
    renderAverageRideDuration(rideDuration);
    
  } catch (error) {
    showError(`Failed to fetch analytics data: ${error.message}`);
  }
}

/**
 * Fetch Average Wait Times from API
 */
async function fetchAverageWaitTimes(startDate, endDate) {
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  
  const url = `${API_BASE_URL}/average-wait-times${params.toString() ? '?' + params.toString() : ''}`;
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Average Wait Times API returned ${response.status}`);
  }
  
  return await response.json();
}

/**
 * Fetch Missed Rides from API
 */
async function fetchMissedRides(startDate, endDate) {
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  
  const url = `${API_BASE_URL}/missed-rides${params.toString() ? '?' + params.toString() : ''}`;
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Missed Rides API returned ${response.status}`);
  }
  
  return await response.json();
}

/**
 * Fetch Average Ride Duration from API
 */
async function fetchAverageRideDuration(startDate, endDate) {
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  
  const url = `${API_BASE_URL}/average-ride-duration${params.toString() ? '?' + params.toString() : ''}`;
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Average Ride Duration API returned ${response.status}`);
  }
  
  return await response.json();
}

/**
 * Render Average Wait Times component
 */
function renderAverageWaitTimes(data) {
  const container = document.getElementById('waitTimesContent');
  
  if (!data.waitTimes || data.waitTimes.length === 0) {
    container.innerHTML = '<div class="no-data">No wait time data available for this period</div>';
    return;
  }
  
  let html = '<table class="metric-table">';
  html += '<thead><tr><th>Zone</th><th>Average Wait</th><th>Sample Size</th></tr></thead>';
  html += '<tbody>';
  
  data.waitTimes.forEach(item => {
    html += '<tr>';
    html += `<td><strong>${escapeHtml(item.zoneName)}</strong></td>`;
    html += `<td>${formatDuration(item.averageWaitSeconds)}</td>`;
    html += `<td class="sample-size">Based on ${item.sampleSize} ride${item.sampleSize !== 1 ? 's' : ''}</td>`;
    html += '</tr>';
  });
  
  html += '</tbody></table>';
  container.innerHTML = html;
}

/**
 * Render Missed Rides component
 */
function renderMissedRides(data) {
  const container = document.getElementById('missedRidesContent');
  
  if (!data.missedRideData || data.missedRideData.length === 0) {
    container.innerHTML = '<div class="no-data">No missed ride data available for this period</div>';
    return;
  }
  
  let html = '<table class="metric-table">';
  html += '<thead><tr><th>Zone</th><th>Missed Ratio</th><th>Details</th></tr></thead>';
  html += '<tbody>';
  
  data.missedRideData.forEach(item => {
    html += '<tr>';
    html += `<td><strong>${escapeHtml(item.zoneName)}</strong></td>`;
    html += `<td>${formatPercentage(item.missedRatio)}</td>`;
    html += `<td class="sample-size">${item.missedCount} missed of ${item.totalQueued} total</td>`;
    html += '</tr>';
  });
  
  html += '</tbody></table>';
  container.innerHTML = html;
}

/**
 * Render Average Ride Duration component
 */
function renderAverageRideDuration(data) {
  const container = document.getElementById('rideDurationContent');
  
  if (!data.rideDurations || data.rideDurations.length === 0) {
    container.innerHTML = '<div class="no-data">No ride duration data available for this period</div>';
    return;
  }
  
  let html = '<table class="metric-table">';
  html += '<thead><tr><th>Zone</th><th>Average Duration</th><th>Sample Size</th></tr></thead>';
  html += '<tbody>';
  
  data.rideDurations.forEach(item => {
    html += '<tr>';
    html += `<td><strong>${escapeHtml(item.zoneName)}</strong></td>`;
    html += `<td>${formatDuration(item.averageDurationSeconds)}</td>`;
    html += `<td class="sample-size">Based on ${item.sampleSize} ride${item.sampleSize !== 1 ? 's' : ''}</td>`;
    html += '</tr>';
  });
  
  html += '</tbody></table>';
  container.innerHTML = html;
}

/**
 * Format seconds into human-readable duration (e.g., "2m 15s" or "5m 30s")
 */
function formatDuration(seconds) {
  if (seconds === null || seconds === undefined || isNaN(seconds)) {
    return 'N/A';
  }
  
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  
  if (mins === 0) {
    return `${secs}s`;
  }
  
  return `${mins}m ${secs}s`;
}

/**
 * Format ratio as percentage (e.g., "15.5%")
 */
function formatPercentage(ratio) {
  if (ratio === null || ratio === undefined || isNaN(ratio)) {
    return 'N/A';
  }
  
  return `${(ratio * 100).toFixed(1)}%`;
}

/**
 * Format Date object to YYYY-MM-DD string
 */
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Show loading state in a container
 */
function showLoading(containerId) {
  const container = document.getElementById(containerId);
  container.innerHTML = '<div class="loading">Loading data...</div>';
}

/**
 * Show error message
 */
function showError(message) {
  const errorDiv = document.getElementById('errorMessage');
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
}

/**
 * Hide error message
 */
function hideError() {
  const errorDiv = document.getElementById('errorMessage');
  errorDiv.style.display = 'none';
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
