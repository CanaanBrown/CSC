// Authentication helper functions
const API_BASE = "http://localhost:5187";

// Get auth token from localStorage or sessionStorage
function getAuthToken() {
  return localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
}

// Get current user from storage
function getCurrentUser() {
  const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
  return userStr ? JSON.parse(userStr) : null;
}

// Check if user is authenticated
async function isAuthenticated() {
  const token = getAuthToken();
  if (!token) return false;
  
  try {
    const response = await fetch(`${API_BASE}/api/auth/check`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.ok;
  } catch (error) {
    return false;
  }
}

// Logout function
function logout() {
  localStorage.removeItem('authToken');
  localStorage.removeItem('user');
  sessionStorage.removeItem('authToken');
  sessionStorage.removeItem('user');
  window.location.href = 'login.html';
}

// Require authentication - redirect to login if not authenticated
async function requireAuth() {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    window.location.href = 'login.html';
    return false;
  }
  return true;
}

