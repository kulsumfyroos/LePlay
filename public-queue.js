/**
 * queue.js – Public Queue Display for LePlay
 * 
 * This script displays the real-time queue status for a selected zone,
 * showing children waiting and currently inside the zone.
 * 
 * API: GET /api/v1/public/queue?zoneId={zoneId}
 */

// API Base URL - update this to match your backend
const API_BASE_URL = "https://www.foreverkid.in/api/v1/public/queue";







// Auto-refresh interval (in milliseconds)
const REFRESH_INTERVAL = 5000; // 5 seconds

// State
let currentZoneId = null;
let selectedZoneName = null;
let refreshIntervalId = null;

// DOM Elements
const zoneBtn = document.getElementById('zoneBtn');
const zoneBtnText = document.getElementById('zoneBtnText');
const zoneDropdown = document.getElementById('zoneDropdown');
const waitingList = document.getElementById('waitingList');
const insideList = document.getElementById('insideList');
const waitingCount = document.getElementById('waitingCount');
const insideCount = document.getElementById('insideCount');
const errorMessage = document.getElementById('errorMessage');
const lastUpdated = document.getElementById('lastUpdated');

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  // Toggle zone dropdown
  zoneBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    zoneDropdown.classList.toggle('show');
  });
  
  // Zone option selection
  const zoneOptions = document.querySelectorAll('.zone-option');
  zoneOptions.forEach(option => {
    option.addEventListener('click', (e) => {
      e.stopPropagation();
      
      // Remove selected class from all options
      zoneOptions.forEach(opt => opt.classList.remove('selected'));
      
      // Add selected class to clicked option
      option.classList.add('selected');
      
      // Store selected zone
      currentZoneId = option.dataset.zone;
      selectedZoneName = option.textContent;
      
      // Update button text
      zoneBtnText.textContent = selectedZoneName;
      
      // Hide dropdown
      zoneDropdown.classList.remove('show');
      
      // Automatically load queue data and start auto-refresh
      handleLoadQueue();
    });
  });
  
  // Close dropdown when clicking outside
  document.addEventListener('click', () => {
    zoneDropdown.classList.remove('show');
  });
  
  // Check if zone is passed in URL query parameter
  const urlParams = new URLSearchParams(window.location.search);
  const zoneParam = urlParams.get('zone');
  if (zoneParam) {
    currentZoneId = zoneParam;
    const matchingOption = Array.from(zoneOptions).find(opt => opt.dataset.zone === zoneParam);
    if (matchingOption) {
      matchingOption.classList.add('selected');
      selectedZoneName = matchingOption.textContent;
      zoneBtnText.textContent = selectedZoneName;
      handleLoadQueue();
    }
  }
});

/**
 * Handle load queue (called automatically when zone is selected)
 */
function handleLoadQueue() {
  if (!currentZoneId) {
    return;
  }
  
  // Stop existing auto-refresh
  if (refreshIntervalId) {
    clearInterval(refreshIntervalId);
    refreshIntervalId = null;
  }
  
  // Load queue data immediately
  fetchQueueData();
  
  // Start auto-refresh (always enabled)
  startAutoRefresh();
}

/**
 * Handle auto-refresh toggle
 */
function handleAutoRefreshToggle() {
  // Auto-refresh is now always enabled, this function kept for compatibility
  if (currentZoneId) {
    startAutoRefresh();
  }
}

/**
 * Start auto-refresh timer
 */
function startAutoRefresh() {
  if (refreshIntervalId) return; // Already running
  
  refreshIntervalId = setInterval(() => {
    if (currentZoneId) {
      fetchQueueData();
    }
  }, REFRESH_INTERVAL);
}

/**
 * Stop auto-refresh timer
 */
function stopAutoRefresh() {
  if (refreshIntervalId) {
    clearInterval(refreshIntervalId);
    refreshIntervalId = null;
  }
}

/**
 * Fetch queue data from API
 */
async function fetchQueueData() {
  if (!currentZoneId) return; // make sure a zone is selected

  try {
    hideError();
    showLoading();

    // 👇 Backend will clearly receive a query like ?zoneId=Z1
    const url = `${API_BASE_URL}?zoneId=${encodeURIComponent(currentZoneId)}`;
    console.log("Fetching data from:", url); // helpful for backend debugging

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`API returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    renderQueueData(data);
    updateLastUpdatedTime();

  } catch (error) {
    console.error("Error fetching queue data:", error);
    showError(`Failed to fetch queue data: ${error.message}`);
    renderEmptyState();
  }
}


/**
 * Render queue data in the UI
 */
function renderQueueData(data) {
  // Render waiting list
  if (data.waiting && data.waiting.length > 0) {
    waitingCount.textContent = data.waiting.length;
    waitingList.innerHTML = '';
    
    data.waiting.forEach((child, index) => {
      const card = createChildCard(child, index + 1);
      waitingList.appendChild(card);
    });
  } else {
    waitingCount.textContent = '0';
    waitingList.innerHTML = '<div class="empty-state">No children waiting</div>';
  }
  
  // Render inside list
  if (data.inside && data.inside.length > 0) {
    insideCount.textContent = data.inside.length;
    insideList.innerHTML = '';
    
    data.inside.forEach((child, index) => {
      const card = createChildCard(child, index + 1);
      insideList.appendChild(card);
    });
  } else {
    insideCount.textContent = '0';
    insideList.innerHTML = '<div class="empty-state">No children inside</div>';
  }
}

/**
 * Create a child card element
 */
function createChildCard(child, position) {
  const card = document.createElement('div');
  card.className = 'child-card';
  
  const numberDiv = document.createElement('div');
  numberDiv.className = 'child-number';
  numberDiv.textContent = position;
  
  const nameDiv = document.createElement('div');
  nameDiv.className = 'child-name';
  nameDiv.textContent = child.name || 'Unknown Child';
  
  card.appendChild(numberDiv);
  card.appendChild(nameDiv);
  
  return card;
}

/**
 * Show loading state
 */
function showLoading() {
  waitingList.innerHTML = '<div class="loading">Loading...</div>';
  insideList.innerHTML = '<div class="loading">Loading...</div>';
}

/**
 * Render empty state (on error)
 */
function renderEmptyState() {
  waitingCount.textContent = '0';
  insideCount.textContent = '0';
  waitingList.innerHTML = '<div class="empty-state">Unable to load data</div>';
  insideList.innerHTML = '<div class="empty-state">Unable to load data</div>';
}

/**
 * Update last updated time
 */
function updateLastUpdatedTime() {
  const now = new Date();
  const timeString = now.toLocaleTimeString();
  lastUpdated.textContent = `Last updated: ${timeString}`;
}

/**
 * Show error message
 */
function showError(message) {
  errorMessage.textContent = message;
  errorMessage.style.display = 'block';
}

/**
 * Hide error message
 */
function hideError() {
  errorMessage.style.display = 'none';
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  stopAutoRefresh();
});
