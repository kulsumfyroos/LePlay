/**
 * Client-side Authentication Module
 * Manages login sessions with 24-hour validity using localStorage
 */

const AUTH_KEYS = {
  ANALYTICS: 'auth_analytics',
  PUBLIC_QUEUE: 'auth_public_queue'
};

const ONE_DAY_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

/**
 * Store authentication data in localStorage
 * @param {string} authKey - The key to store auth data under (analytics or public-queue)
 * @param {string} username - The username/identifier
 */
function storeAuth(authKey, username) {
  const authData = {
    username: username,
    loginTime: Date.now()
  };
  localStorage.setItem(authKey, JSON.stringify(authData));
}

/**
 * Check if user is logged in and session is valid
 * @param {string} authKey - The key to check auth data for
 * @returns {boolean} - True if logged in and not expired
 */
function isLoggedIn(authKey) {
  const data = localStorage.getItem(authKey);
  
  if (!data) {
    return false;
  }

  try {
    const { loginTime } = JSON.parse(data);
    const now = Date.now();

    // Check if session has expired (more than 24 hours)
    if (now - loginTime > ONE_DAY_MS) {
      // Auto-logout on expiry
      localStorage.removeItem(authKey);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Auth check error:', error);
    localStorage.removeItem(authKey);
    return false;
  }
}

/**
 * Get current user data from localStorage
 * @param {string} authKey - The key to retrieve auth data from
 * @returns {object|null} - User data or null if not logged in
 */
function getUserData(authKey) {
  const data = localStorage.getItem(authKey);
  
  if (!data) {
    return null;
  }

  try {
    return JSON.parse(data);
  } catch (error) {
    console.error('Error parsing user data:', error);
    return null;
  }
}

/**
 * Logout user by removing auth data
 * @param {string} authKey - The key to remove
 * @param {string} redirectUrl - URL to redirect to after logout
 */
function logout(authKey, redirectUrl) {
  localStorage.removeItem(authKey);
  window.location.href = redirectUrl;
}

/**
 * Protect a page - redirect to login if not authenticated
 * @param {string} authKey - The key to check
 * @param {string} loginUrl - URL of the login page
 */
function protectPage(authKey, loginUrl) {
  if (!isLoggedIn(authKey)) {
    window.location.href = loginUrl;
  }
}

/**
 * Get remaining session time in a human-readable format
 * @param {string} authKey - The key to check
 * @returns {string} - Formatted remaining time
 */
function getRemainingSessionTime(authKey) {
  const data = localStorage.getItem(authKey);
  
  if (!data) {
    return 'Not logged in';
  }

  try {
    const { loginTime } = JSON.parse(data);
    const now = Date.now();
    const elapsed = now - loginTime;
    const remaining = ONE_DAY_MS - elapsed;

    if (remaining <= 0) {
      return 'Expired';
    }

    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

    return `${hours}h ${minutes}m`;
  } catch (error) {
    return 'Error';
  }
}
