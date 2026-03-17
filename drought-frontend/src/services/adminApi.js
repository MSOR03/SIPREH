/**
 * Admin API Service for DroughtMonitor
 * Handles authentication, user management, and file operations
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

// ── Token helpers ──────────────────────────────────────────────
function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('admin_token');
}

function setToken(token) {
  localStorage.setItem('admin_token', token);
}

function clearToken() {
  localStorage.removeItem('admin_token');
}

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ── Base fetch with auth ───────────────────────────────────────
async function fetchAdmin(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;

  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...(options.headers || {}),
    },
  };

  // Remove Content-Type for FormData (file uploads)
  if (options.body instanceof FormData) {
    delete config.headers['Content-Type'];
  }

  const response = await fetch(url, config);

  const contentType = response.headers.get('content-type');
  let data;
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const msg = typeof data === 'object'
      ? (data.detail || data.message || JSON.stringify(data))
      : data;
    const err = new Error(msg);
    err.status = response.status;
    err.data = data;
    throw err;
  }

  return data;
}

// ── Auth ───────────────────────────────────────────────────────
export const authApi = {
  async login(email, password) {
    const data = await fetchAdmin('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setToken(data.access_token);
    return data;
  },

  async me() {
    return fetchAdmin('/auth/me');
  },

  logout() {
    clearToken();
  },

  isAuthenticated() {
    return !!getToken();
  },
};

// ── Users ──────────────────────────────────────────────────────
export const usersApi = {
  async list(skip = 0, limit = 100) {
    return fetchAdmin(`/admin/users?skip=${skip}&limit=${limit}`);
  },

  async get(userId) {
    return fetchAdmin(`/admin/users/${userId}`);
  },

  async create(userData) {
    return fetchAdmin('/admin/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  },

  async update(userId, userData) {
    return fetchAdmin(`/admin/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
  },
};

// ── Files ──────────────────────────────────────────────────────
export const filesApi = {
  async list(skip = 0, limit = 100, statusFilter = null) {
    let url = `/admin/files?skip=${skip}&limit=${limit}`;
    if (statusFilter) url += `&status_filter=${statusFilter}`;
    return fetchAdmin(url);
  },

  async get(fileId) {
    return fetchAdmin(`/admin/files/${fileId}`);
  },

  async delete(fileId, deleteFromCloud = true) {
    return fetchAdmin(`/admin/files/${fileId}?delete_from_cloud=${deleteFromCloud}`, {
      method: 'DELETE',
    });
  },

  async activate(fileId) {
    return fetchAdmin(`/admin/files/${fileId}/activate`, {
      method: 'POST',
    });
  },

  async getDownloadUrl(fileId) {
    return fetchAdmin(`/admin/files/${fileId}/download-url`);
  },

  async upload(file) {
    const formData = new FormData();
    formData.append('file', file);
    return fetchAdmin('/parquet/upload', {
      method: 'POST',
      body: formData,
    });
  },

  async getMetadata(fileId) {
    return fetchAdmin(`/parquet/metadata/${fileId}`);
  },

  async listCloud(prefix = 'parquet/') {
    return fetchAdmin(`/admin/files/cloud/list?prefix=${encodeURIComponent(prefix)}`);
  },

  async syncCloud(prefix = 'parquet/', autoActivate = true, bidirectional = true) {
    return fetchAdmin(
      `/admin/files/cloud/sync?prefix=${encodeURIComponent(prefix)}&auto_activate=${autoActivate}&bidirectional=${bidirectional}`,
      { method: 'POST' }
    );
  },

  async getDatasetCatalog() {
    return fetchAdmin('/admin/datasets/catalog');
  },

  async attachToDataset(payload) {
    return fetchAdmin('/admin/datasets/attach-file', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getDatasetStatus(datasetKey) {
    return fetchAdmin(`/admin/datasets/${encodeURIComponent(datasetKey)}/status`);
  },

  async mergeAndRollover(payload) {
    return fetchAdmin('/admin/datasets/merge-and-rollover', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};
