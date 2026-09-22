/**
 * Retrieves the API Base URL.
 * Priority:
 * 1. Saved user preference in localStorage (useful when deployed on static GitHub Pages)
 * 2. Vite environment variable: VITE_API_BASE
 * 3. Default: empty string (relative to current origin, works when served by Express)
 */
export function getApiBase() {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('saddhamma_api_base');
    if (saved) return saved.replace(/\/+$/, '');
  }

  if (import.meta.env.VITE_API_BASE) {
    return import.meta.env.VITE_API_BASE.replace(/\/+$/, '');
  }

  return '';
}

export function setApiBase(url) {
  if (typeof window !== 'undefined') {
    if (!url) {
      localStorage.removeItem('saddhamma_api_base');
    } else {
      localStorage.setItem('saddhamma_api_base', url.trim().replace(/\/+$/, ''));
    }
  }
}

/**
 * Returns full API URL for any endpoint.
 */
export function apiUrl(endpoint) {
  const base = getApiBase();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${base}${cleanEndpoint}`;
}
