(function (window, document) {
  'use strict';

  var API_BASE_STORAGE_KEY = 'xuanphu_api_base';
  var ADMIN_TOKEN_STORAGE_KEY = 'xuanphu_admin_token';
  var API_BASE_QUERY_KEYS = ['apiBase', 'api_base', 'backend', 'backendHost'];

  function getStorage() {
    try {
      return window.localStorage;
    } catch (error) {
      return null;
    }
  }

  function trimTrailingSlash(value) {
    return String(value || '').replace(/\/+$/, '');
  }

  function normalizeApiBase(rawValue) {
    var value = String(rawValue || '').trim();
    if (!value) return '';

    try {
      if (/^https?:\/\//i.test(value)) {
        return trimTrailingSlash(new URL(value).origin);
      }

      return trimTrailingSlash(new URL(value, window.location.origin).origin);
    } catch (error) {
      return '';
    }
  }

  function getQueryApiBase() {
    var query = new URLSearchParams(window.location.search);

    for (var index = 0; index < API_BASE_QUERY_KEYS.length; index += 1) {
      var key = API_BASE_QUERY_KEYS[index];
      if (query.has(key)) {
        return query.get(key) || '';
      }
    }

    return '';
  }

  function getDefaultApiBase() {
    return window.location.protocol === 'file:'
      ? 'http://localhost:3000'
      : window.location.origin;
  }

  function setApiBase(rawValue) {
    var storage = getStorage();
    var normalized = normalizeApiBase(rawValue);

    if (storage) {
      if (normalized) {
        storage.setItem(API_BASE_STORAGE_KEY, normalized);
      } else {
        storage.removeItem(API_BASE_STORAGE_KEY);
      }
    }

    return normalized;
  }

  function getStoredApiBase() {
    var storage = getStorage();
    return storage ? normalizeApiBase(storage.getItem(API_BASE_STORAGE_KEY)) : '';
  }

  function getMetaApiBase() {
    var meta = document.querySelector('meta[name="xuanphu-api-base"]');
    return meta ? normalizeApiBase(meta.getAttribute('content')) : '';
  }

  function getApiBase() {
    var queryApiBase = getQueryApiBase();
    if (queryApiBase) {
      return setApiBase(queryApiBase) || normalizeApiBase(getDefaultApiBase());
    }

    return getStoredApiBase()
      || getMetaApiBase()
      || normalizeApiBase(getDefaultApiBase())
      || getDefaultApiBase();
  }

  function buildApiUrl(path) {
    if (/^https?:\/\//i.test(String(path || ''))) {
      return String(path);
    }

    var normalizedPath = String(path || '').trim();
    if (!normalizedPath) {
      return getApiBase();
    }

    if (normalizedPath.charAt(0) !== '/') {
      normalizedPath = '/' + normalizedPath;
    }

    return getApiBase() + normalizedPath;
  }

  function resolveAssetUrl(assetPath) {
    var value = String(assetPath || '').trim();
    if (!value) return '';

    if (/^(https?:)?\/\//i.test(value) || /^(data|blob):/i.test(value)) {
      return value;
    }

    if (value.charAt(0) === '/') {
      return buildApiUrl(value);
    }

    return value;
  }

  function isSameOriginApi() {
    return normalizeApiBase(getApiBase()) === normalizeApiBase(window.location.origin);
  }

  function getAdminToken() {
    var storage = getStorage();
    return storage ? String(storage.getItem(ADMIN_TOKEN_STORAGE_KEY) || '') : '';
  }

  function setAdminToken(token) {
    var storage = getStorage();
    if (!storage) return '';

    var normalized = String(token || '').trim();
    if (normalized) {
      storage.setItem(ADMIN_TOKEN_STORAGE_KEY, normalized);
    } else {
      storage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    }

    return normalized;
  }

  function clearAdminToken() {
    setAdminToken('');
  }

  function createAdminRequestInit(options) {
    var init = Object.assign({}, options || {});
    var headers = Object.assign({}, init.headers || {});
    var adminToken = getAdminToken();

    if (adminToken) {
      headers.Authorization = 'Bearer ' + adminToken;
    }

    init.headers = headers;

    if (!init.credentials) {
      init.credentials = isSameOriginApi() ? 'same-origin' : 'omit';
    }

    return init;
  }

  function getAdminLoginUrl() {
    return isSameOriginApi()
      ? '/admin/login'
      : new URL('./login.html', window.location.href).href;
  }

  function getAdminDashboardUrl() {
    return isSameOriginApi()
      ? '/admin'
      : new URL('./products.html', window.location.href).href;
  }

  window.XuanPhuApi = {
    buildApiUrl: buildApiUrl,
    clearAdminToken: clearAdminToken,
    createAdminRequestInit: createAdminRequestInit,
    getAdminDashboardUrl: getAdminDashboardUrl,
    getAdminLoginUrl: getAdminLoginUrl,
    getAdminToken: getAdminToken,
    getApiBase: getApiBase,
    isSameOriginApi: isSameOriginApi,
    resolveAssetUrl: resolveAssetUrl,
    setAdminToken: setAdminToken,
    setApiBase: setApiBase
  };
}(window, document));
