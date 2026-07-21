/**
 * Authenticated API fetch utility wrapper for NKB Formulation System
 * Supports automatic token refresh on 401 and request retry
 */

let refreshPromise = null;

export async function apiFetch(url, options = {}) {
  let token = localStorage.getItem('nkb_access_token');
  
  const headers = {
    ...(options.headers || {}),
  };

  // Only set Content-Type if body is present and not explicitly omitted
  if (options.body && !headers['Content-Type'] && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response = await fetch(url, {
    ...options,
    headers,
  });

  // Handle Token Expiration (401) seamlessly
  if (response.status === 401 && !options._isRetry) {
    const refreshToken = localStorage.getItem('nkb_refresh_token');

    if (!refreshToken) {
      localStorage.clear();
      window.location.reload();
      return response;
    }

    if (!refreshPromise) {
      refreshPromise = (async () => {
        try {
          const refreshRes = await fetch('/api/v1/auth/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
          });

          const refreshData = await refreshRes.json();

          if (refreshRes.ok && refreshData.success && refreshData.accessToken) {
            localStorage.setItem('nkb_access_token', refreshData.accessToken);
            localStorage.setItem('nkb_refresh_token', refreshData.refreshToken);
            return refreshData.accessToken;
          } else {
            localStorage.clear();
            window.location.reload();
            return null;
          }
        } catch (err) {
          localStorage.clear();
          window.location.reload();
          return null;
        } finally {
          refreshPromise = null;
        }
      })();
    }

    const newToken = await refreshPromise;
    if (newToken) {
      const retryHeaders = {
        ...headers,
        'Authorization': `Bearer ${newToken}`,
      };
      response = await fetch(url, {
        ...options,
        _isRetry: true,
        headers: retryHeaders,
      });
    }
  }

  return response;
}

export async function apiJson(url, options = {}) {
  const res = await apiFetch(url, options);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || `Request failed with status ${res.status}`);
  }
  return data;
}
