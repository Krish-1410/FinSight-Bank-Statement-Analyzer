/**
 * FinSight Centralized API Client
 * Robust handling of fetch, credentials, error handling, and session management
 */

class ApiClient {
  constructor() {
    this.baseUrl = '/api';
    this.isAutoLoggingIn = false;
  }

  getToken() {
    return localStorage.getItem('finsight_token') || sessionStorage.getItem('finsight_token');
  }

  setToken(token) {
    if (token) {
      localStorage.setItem('finsight_token', token);
      sessionStorage.setItem('finsight_token', token);
    } else {
      localStorage.removeItem('finsight_token');
      sessionStorage.removeItem('finsight_token');
    }
  }

  getUser() {
    try {
      const u = localStorage.getItem('finsight_user') || sessionStorage.getItem('finsight_user');
      return u ? JSON.parse(u) : null;
    } catch (e) {
      return null;
    }
  }

  setUser(user) {
    if (user) {
      const s = JSON.stringify(user);
      localStorage.setItem('finsight_user', s);
      sessionStorage.setItem('finsight_user', s);
    } else {
      localStorage.removeItem('finsight_user');
      sessionStorage.removeItem('finsight_user');
    }
  }

  clearAuth() {
    localStorage.removeItem('finsight_token');
    sessionStorage.removeItem('finsight_token');
    localStorage.removeItem('finsight_user');
    sessionStorage.removeItem('finsight_user');
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    let token = this.getToken();

    // Auto-authenticate as demo if completely unauthenticated on app pages
    if (!token && !endpoint.includes('/auth/') && !this.isAutoLoggingIn) {
      try {
        this.isAutoLoggingIn = true;
        const demoRes = await this.auth.demoLogin();
        token = demoRes.data?.token;
      } catch (e) {
        // fallback
      } finally {
        this.isAutoLoggingIn = false;
      }
    }

    const headers = {
      ...options.headers,
    };

    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include',
      });

      if (response.status === 401) {
        // Try auto demo login once
        if (!endpoint.includes('/auth/login') && !endpoint.includes('/auth/register') && !this.isAutoLoggingIn) {
          try {
            this.isAutoLoggingIn = true;
            const demoRes = await this.auth.demoLogin();
            this.isAutoLoggingIn = false;
            if (demoRes.data?.token) {
              return this.request(endpoint, options);
            }
          } catch (e) {
            this.isAutoLoggingIn = false;
          }
        }
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || `Request failed with status ${response.status}`);
        }
        return data;
      }

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      return response;
    } catch (err) {
      console.error(`[API Error] ${options.method || 'GET'} ${endpoint}:`, err);
      throw err;
    }
  }

  get(endpoint, params = {}) {
    const qs = new URLSearchParams(params).toString();
    const url = qs ? `${endpoint}?${qs}` : endpoint;
    return this.request(url, { method: 'GET' });
  }

  post(endpoint, body) {
    const options = {
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body),
    };
    return this.request(endpoint, options);
  }

  put(endpoint, body) {
    const options = {
      method: 'PUT',
      body: body instanceof FormData ? body : JSON.stringify(body),
    };
    return this.request(endpoint, options);
  }

  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }

  auth = {
    register: async (payload) => {
      const res = await this.post('/auth/register', payload);
      if (res.data?.token) {
        this.setToken(res.data.token);
        this.setUser(res.data.user);
      }
      return res;
    },
    login: async (payload) => {
      const res = await this.post('/auth/login', payload);
      if (res.data?.token) {
        this.setToken(res.data.token);
        this.setUser(res.data.user);
      }
      return res;
    },
    demoLogin: async () => {
      const res = await this.post('/auth/demo', {});
      if (res.data?.token) {
        this.setToken(res.data.token);
        this.setUser(res.data.user);
      }
      return res;
    },
    logout: async () => {
      try {
        await this.post('/auth/logout', {});
      } finally {
        this.clearAuth();
        window.location.href = '/login.html';
      }
    },
    me: async () => {
      return this.get('/auth/me');
    },
    changePassword: async (payload) => {
      return this.post('/auth/change-password', payload);
    },
  };

  statements = {
    upload: async (file, clearPrevious = true) => {
      const formData = new FormData();
      formData.append('statement', file);
      if (clearPrevious) {
        formData.append('clearPrevious', 'true');
      }
      return this.post('/statements/upload', formData);
    },
    getAll: async () => {
      return this.get('/statements');
    },
    delete: async (id) => {
      return this.delete(`/statements/${id}`);
    },
    clearAll: async () => {
      return this.delete('/statements/clear-all');
    },
    loadDemo: async (clearPrevious = true) => {
      return this.post('/statements/demo', { clearPrevious });
    },
  };

  dashboard = {
    getSummary: async (params = {}) => {
      return this.get('/dashboard/summary', params);
    },
    getCategories: async (params = {}) => {
      return this.get('/dashboard/categories', params);
    },
    getMonthly: async (params = {}) => {
      return this.get('/dashboard/monthly', params);
    },
    getDivisions: async (params = {}) => {
      return this.get('/dashboard/divisions', params);
    },
  };

  transactions = {
    getAll: async (params = {}) => {
      return this.get('/transactions', params);
    },
    getById: async (id) => {
      return this.get(`/transactions/${id}`);
    },
    create: async (payload) => {
      return this.post('/transactions', payload);
    },
    update: async (id, payload) => {
      return this.put(`/transactions/${id}`, payload);
    },
    delete: async (id) => {
      return this.delete(`/transactions/${id}`);
    },
    resetDemo: async () => {
      return this.post('/transactions/reset-demo', {});
    },
  };

  insights = {
    getAll: async (params = {}) => {
      return this.get('/insights', params);
    },
    getRecurring: async () => {
      return this.get('/recurring-payments');
    },
  };

  reports = {
    getSummary: async (params = {}) => {
      return this.get('/reports/summary', params);
    },
  };
}

export const api = new ApiClient();
window.api = api;
