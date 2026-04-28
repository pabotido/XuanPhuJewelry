(function (window, document) {
  'use strict';

  var FALLBACK_IMAGE = '/img/image.png';
  var PRODUCTS_API_URL = '/api/products';
  var USER_ME_API_URL = '/api/users/me';
  var USER_ORDERS_API_URL = '/api/users/orders';
  var USER_LOGIN_API_URL = '/api/users/login';
  var USER_REGISTER_API_URL = '/api/users/register';
  var USER_LOGOUT_API_URL = '/api/users/logout';
  var ORDERS_API_URL = '/api/orders';
  var CART_STORAGE_KEY = 'xuanphu_storefront_cart';
  var LEGACY_FAVORITES_STORAGE_KEY = 'xuanphu_storefront_favorites';
  var FAVORITES_STORAGE_KEY = 'xuanphu_storefront_favorites_by_scope';
  var FAVORITES_GUEST_SCOPE = 'guest';
  var DEFAULT_CATEGORY = 'Pho bien';
  var ALLOWED_CATEGORIES = {
    'Pho bien': 'popular',
    'Moi nhat': 'latest',
    'Phổ biến': 'popular',
    'Mới nhất': 'latest'
  };
  var STORE_ROUTES = {
    popular: '/',
    latest: '/latest',
    favorites: '/favorites',
    prices: '/prices',
    auth: '/auth',
    login: '/login',
    register: '/register',
    account: '/account',
    admin: '/admin'
  };
  var FILE_ROUTES = {
    popular: './index.html',
    latest: './latest.html',
    favorites: './favorites.html',
    prices: './prices.html',
    auth: './auth.html',
    login: './auth.html',
    register: './auth.html',
    account: './account.html',
    admin: '../admin/products.html'
  };

  document.addEventListener('DOMContentLoaded', function () {
    if (document.body.dataset.page !== 'storefront') return;

    var storePage = document.body.dataset.storePage || 'popular';
    var apiClient = window.XuanPhuApi || null;
    var currentUser = null;
    var currentProduct = null;
    var productsCache = [];
    var favoriteBuckets = readFavoriteBuckets();
    var favorites = readFavoritesForUser(null);
    var cart = readStorage(CART_STORAGE_KEY, []);

    var elements = {
      searchInput: document.getElementById('phu-search'),
      openCartBtn: document.getElementById('open-cart'),
      cartCountEl: document.getElementById('cart-count'),
      clearCartBtn: document.getElementById('clear-cart'),
      cartItemsEl: document.getElementById('cart-items'),
      cartSubtotalEl: document.getElementById('cart-subtotal'),
      cartTotalEl: document.getElementById('cart-total'),
      checkoutForm: document.getElementById('checkout-form'),
      checkoutFeedback: document.getElementById('checkout-feedback'),
      placeOrderBtn: document.getElementById('place-order'),
      paymentCardEl: document.querySelector('#cart-overlay .payment-card'),
      paymentField: document.getElementById('checkout-payment'),
      paymentButtons: document.querySelectorAll('.payment-btn'),
      cardSection: document.getElementById('card-payment-section'),
      shippingSection: document.getElementById('cod-payment-section'),
      detailImage: document.getElementById('detail-image'),
      detailCategory: document.getElementById('detail-category'),
      detailName: document.getElementById('detail-name'),
      detailPrice: document.getElementById('detail-price'),
      detailDescription: document.getElementById('detail-description'),
      detailSku: document.getElementById('detail-sku'),
      detailMaterial: document.getElementById('detail-material'),
      detailWeight: document.getElementById('detail-weight'),
      detailAddCartBtn: document.getElementById('detail-add-cart'),
      detailBuyNowBtn: document.getElementById('detail-buy-now'),
      openAccountBtn: document.getElementById('open-account'),
      accountTriggerKicker: document.getElementById('account-trigger-kicker'),
      accountTriggerName: document.getElementById('account-trigger-name'),
      accountFeedback: document.getElementById('account-feedback'),
      accountSessionCard: document.getElementById('account-session-card'),
      accountHistoryCard: document.getElementById('account-history-card'),
      accountOrderHistory: document.getElementById('account-order-history'),
      accountForms: document.getElementById('account-forms'),
      accountLogoutBtn: document.getElementById('account-logout'),
      accountSwitchButtons: document.querySelectorAll('[data-account-tab-switch]'),
      loginForm: document.getElementById('user-login-form'),
      registerForm: document.getElementById('user-register-form'),
      sessionUserName: document.getElementById('session-user-name'),
      sessionUserEmail: document.getElementById('session-user-email'),
      sessionUserPhone: document.getElementById('session-user-phone'),
      sessionUserAddress: document.getElementById('session-user-address'),
      popularGallery: document.getElementById('popular-gallery'),
      latestGallery: document.getElementById('latest-gallery'),
      favoriteGallery: document.querySelector('.favorite-gallery'),
      favoriteEmpty: document.querySelector('.favorite-empty')
    };

    window.showProductDetail = showProductDetail;
    window.addToCart = addToCart;

    applyInitialMessage();
    initializePaymentMethod('bank');
    updateCartDisplay();
    renderCurrentUser(null);
    bindEvents();
    applyAuthMode();
    loadCurrentUser();
    fetchProductsIfNeeded();

    function bindEvents() {
      if (elements.searchInput) {
        elements.searchInput.addEventListener('input', function () {
          applySearch(elements.searchInput.value);
        });
      }

      if (elements.openCartBtn) {
        elements.openCartBtn.addEventListener('click', function () {
          if (!requireStorefrontLogin('Vui long dang nhap de dung gio hang.')) {
            return;
          }

          showOverlay('cart-overlay');
          prefillCheckoutFromUser();
        });
      }

      if (elements.clearCartBtn) {
        elements.clearCartBtn.addEventListener('click', function () {
          cart = [];
          saveCart();
          updateCartDisplay();
          hideOverlay('cart-overlay');
        });
      }

      if (elements.checkoutForm) {
        elements.checkoutForm.addEventListener('submit', handleCheckout);
      }

      elements.paymentButtons.forEach(function (button) {
        button.addEventListener('click', function (event) {
          event.preventDefault();
          initializePaymentMethod(button.dataset.method || 'bank');
        });
      });

      document.addEventListener('click', function (event) {
        if (event.target.matches('[data-close-overlay]')) {
          hideOverlay(event.target.dataset.closeOverlay);
        }
      });

      if (elements.detailAddCartBtn) {
        elements.detailAddCartBtn.addEventListener('click', function () {
          if (!currentProduct) return;
          if (addToCart(currentProduct, { sourceOverlayId: 'product-detail-modal' })) {
            hideOverlay('product-detail-modal');
          }
        });
      }

      if (elements.detailBuyNowBtn) {
        elements.detailBuyNowBtn.addEventListener('click', function () {
          if (!currentProduct) return;
          if (!addToCart(currentProduct, { sourceOverlayId: 'product-detail-modal' })) {
            return;
          }

          hideOverlay('product-detail-modal');
          showOverlay('cart-overlay');
          prefillCheckoutFromUser();
        });
      }

      if (elements.openAccountBtn) {
        elements.openAccountBtn.addEventListener('click', function () {
          redirectToStorePage(currentUser ? 'account' : 'login');
        });
      }

      elements.accountSwitchButtons.forEach(function (button) {
        button.addEventListener('click', function () {
          redirectToStorePage(button.dataset.accountTabSwitch === 'register' ? 'register' : 'login');
        });
      });

      if (elements.loginForm) {
        elements.loginForm.addEventListener('submit', handleLoginSubmit);
      }

      if (elements.registerForm) {
        elements.registerForm.addEventListener('submit', handleRegisterSubmit);
      }

      if (elements.accountLogoutBtn) {
        elements.accountLogoutBtn.addEventListener('click', handleLogoutSubmit);
      }
    }

    function fetchProductsIfNeeded() {
      if (!elements.popularGallery && !elements.latestGallery && !elements.favoriteGallery) return;

      fetchJson(PRODUCTS_API_URL)
        .then(function (products) {
          productsCache = Array.isArray(products) ? products.map(normalizeProduct) : [];
          renderProducts(productsCache);
        })
        .catch(function (error) {
          console.error(error);
          renderMessage('popular-gallery', 'Khong the ket noi backend hien tai.', 'is-error');
          renderMessage('latest-gallery', 'Khong the tai danh sach san pham moi nhat.', 'is-error');
          renderFavoriteMessage(error.message || 'Khong the tai san pham yeu thich.', 'is-error');
        });
    }

    function normalizeProduct(product) {
      var category = normalizeCategory(product.Category);
      return {
        id: product.Id,
        name: product.Name,
        imageUrl: resolveAssetUrl(product.ImageUrl) || FALLBACK_IMAGE,
        category: category,
        price: product.Price,
        description: product.Description,
        sku: product.Sku,
        material: product.Material,
        weight: product.Weight,
        currency: product.Currency
      };
    }

    function normalizeCategory(category) {
      return ALLOWED_CATEGORIES[category] ? category : DEFAULT_CATEGORY;
    }

    function renderProducts(products) {
      var grouped = { popular: [], latest: [] };

      products.forEach(function (product) {
        grouped[ALLOWED_CATEGORIES[product.category]].push(product);
      });

      renderGallery('popular-gallery', grouped.popular, 'Chua co san pham thuoc nhom Pho bien.');
      renderGallery('latest-gallery', grouped.latest, 'Chua co san pham thuoc nhom Moi nhat.');
      renderFavoriteProducts(products);
      applySearch(elements.searchInput ? elements.searchInput.value : '');
    }

    function renderGallery(galleryId, products, emptyMessage) {
      var gallery = document.getElementById(galleryId);
      if (!gallery) return;

      gallery.innerHTML = '';

      if (!products.length) {
        gallery.appendChild(createMessage(emptyMessage, 'is-empty'));
        return;
      }

      products.forEach(function (product) {
        gallery.appendChild(createProductCard(product));
      });
    }

    function renderFavoriteProducts(products) {
      if (!elements.favoriteGallery) return;

      var favoriteProducts = buildFavoriteProducts(products);
      elements.favoriteGallery.innerHTML = '';

      if (!favoriteProducts.length) {
        if (elements.favoriteEmpty) elements.favoriteEmpty.style.display = '';
        return;
      }

      favoriteProducts.forEach(function (product) {
        elements.favoriteGallery.appendChild(createProductCard(product));
      });

      if (elements.favoriteEmpty) elements.favoriteEmpty.style.display = 'none';
    }

    function buildFavoriteProducts(products) {
      var productMap = new Map();
      products.forEach(function (product) {
        productMap.set(String(product.id), product);
      });

      return Object.keys(favorites).map(function (productId) {
        return productMap.get(productId) || favorites[productId];
      }).filter(Boolean);
    }

    function readFavoriteBuckets() {
      var storedBuckets = readStorage(FAVORITES_STORAGE_KEY, null);
      if (storedBuckets && typeof storedBuckets === 'object' && !Array.isArray(storedBuckets)) {
        return normalizeFavoriteBuckets(storedBuckets);
      }

      var legacyFavorites = normalizeFavoriteBucket(readStorage(LEGACY_FAVORITES_STORAGE_KEY, null));
      if (!Object.keys(legacyFavorites).length) {
        return {};
      }

      storedBuckets = {};
      storedBuckets[FAVORITES_GUEST_SCOPE] = legacyFavorites;
      writeStorage(FAVORITES_STORAGE_KEY, storedBuckets);
      return storedBuckets;
    }

    function normalizeFavoriteBuckets(rawBuckets) {
      return Object.keys(rawBuckets || {}).reduce(function (acc, scopeKey) {
        var normalizedScopeKey = String(scopeKey || '').trim();
        var normalizedBucket = normalizeFavoriteBucket(rawBuckets[scopeKey]);

        if (!normalizedScopeKey || !Object.keys(normalizedBucket).length) {
          return acc;
        }

        acc[normalizedScopeKey] = normalizedBucket;
        return acc;
      }, {});
    }

    function normalizeFavoriteBucket(rawBucket) {
      if (!rawBucket || typeof rawBucket !== 'object' || Array.isArray(rawBucket)) {
        return {};
      }

      return Object.keys(rawBucket).reduce(function (acc, productId) {
        var normalizedId = String(productId || '').trim();
        var product = rawBucket[productId];

        if (!normalizedId || !product || typeof product !== 'object' || Array.isArray(product)) {
          return acc;
        }

        acc[normalizedId] = product;
        return acc;
      }, {});
    }

    function getFavoriteScope(user) {
      var userId = user && user.id !== undefined && user.id !== null
        ? String(user.id).trim()
        : '';

      if (userId) {
        return 'user:' + userId;
      }

      var email = user && user.email ? String(user.email).trim().toLowerCase() : '';
      return email ? 'email:' + email : FAVORITES_GUEST_SCOPE;
    }

    function readFavoritesForUser(user) {
      return normalizeFavoriteBucket(favoriteBuckets[getFavoriteScope(user)]);
    }

    function saveFavorites() {
      var scopeKey = getFavoriteScope(currentUser);
      var normalizedFavorites = normalizeFavoriteBucket(favorites);

      if (Object.keys(normalizedFavorites).length) {
        favoriteBuckets[scopeKey] = normalizedFavorites;
      } else {
        delete favoriteBuckets[scopeKey];
      }

      writeStorage(FAVORITES_STORAGE_KEY, favoriteBuckets);
    }

    function refreshFavoritesState() {
      favorites = readFavoritesForUser(currentUser);
      syncVisibleFavoriteButtons();

      if (elements.favoriteGallery) {
        renderFavoriteProducts(productsCache);
        applySearch(elements.searchInput ? elements.searchInput.value : '');
      }
    }

    function syncVisibleFavoriteButtons() {
      document.querySelectorAll('.phu-card[data-card-id]').forEach(function (card) {
        syncFavoriteButton(card, Boolean(favorites[String(card.dataset.cardId || '')]));
      });
    }

    function createProductCard(product) {
      var card = document.createElement('div');
      var teaser = truncateText(product.description || 'Thiet ke trang suc duoc tuyen chon de de phoi va de tang.', 88);

      card.className = 'card phu-card with-fav';
      card.dataset.cardId = String(product.id);
      card.dataset.product = JSON.stringify(product);
      card.innerHTML = [
        '<div class="thumb">',
        '  <img src="' + escapeHtml(product.imageUrl) + '" alt="' + escapeHtml(product.name) + '">',
        '  <button class="fav-btn" type="button" aria-label="Yeu thich">♡</button>',
        '</div>',
        '<div class="meta">',
        '  <div class="card-top">',
        '    <span class="card-tag">' + escapeHtml(product.category || DEFAULT_CATEGORY) + '</span>',
        '    <p class="price">' + formatPrice(product.price) + '</p>',
        '  </div>',
        '  <h3>' + escapeHtml(product.name) + '</h3>',
        '  <p class="product-teaser">' + escapeHtml(teaser) + '</p>',
        '  <div class="buttons">',
        '    <button type="button" class="btn-muted detail-btn">Chi tiet</button>',
        '    <button type="button" class="purchase buy-btn">Mua ngay</button>',
        '  </div>',
        '</div>'
      ].join('');

      var image = card.querySelector('img');
      var detailBtn = card.querySelector('.detail-btn');
      var buyBtn = card.querySelector('.buy-btn');
      var favoriteBtn = card.querySelector('.fav-btn');

      if (image) attachImageFallback(image, FALLBACK_IMAGE);
      if (detailBtn) {
        detailBtn.addEventListener('click', function () {
          showProductDetail(product);
        });
      }
      if (buyBtn) {
        buyBtn.addEventListener('click', function () {
          addToCart(product);
        });
      }
      if (favoriteBtn) {
        favoriteBtn.addEventListener('click', function () {
          toggleFavorite(product.id, product);
        });
      }

      syncFavoriteButton(card, Boolean(favorites[String(product.id)]));
      return card;
    }

    function toggleFavorite(productId, product) {
      var normalizedId = String(productId || '');
      if (!normalizedId) return;

      if (favorites[normalizedId]) {
        delete favorites[normalizedId];
      } else {
        favorites[normalizedId] = product;
      }

      saveFavorites();
      syncFavoriteState(normalizedId, Boolean(favorites[normalizedId]));

      if (elements.favoriteGallery) {
        renderFavoriteProducts(productsCache);
        applySearch(elements.searchInput ? elements.searchInput.value : '');
      }
    }

    function syncFavoriteState(productId, isActive) {
      document.querySelectorAll('.phu-card[data-card-id="' + productId + '"]').forEach(function (card) {
        syncFavoriteButton(card, isActive);
      });
    }

    function syncFavoriteButton(card, isActive) {
      var button = card.querySelector('.fav-btn');
      if (!button) return;
      button.classList.toggle('active', isActive);
      button.textContent = isActive ? '♥' : '♡';
    }

    function renderMessage(galleryId, message, stateClass) {
      var gallery = document.getElementById(galleryId);
      if (!gallery) return;

      gallery.innerHTML = '';
      gallery.appendChild(createMessage(message, stateClass));
    }

    function renderFavoriteMessage(message, stateClass) {
      if (!elements.favoriteGallery) return;
      elements.favoriteGallery.innerHTML = '';
      elements.favoriteGallery.appendChild(createMessage(message, stateClass));
      if (elements.favoriteEmpty) elements.favoriteEmpty.style.display = 'none';
    }

    function createMessage(message, stateClass) {
      var paragraph = document.createElement('p');
      paragraph.className = 'gallery-message' + (stateClass ? ' ' + stateClass : '');
      paragraph.textContent = message;
      return paragraph;
    }

    function applySearch(query) {
      var normalizedQuery = String(query || '').trim().toLowerCase();
      document.querySelectorAll('.gallery .phu-card').forEach(function (card) {
        var title = card.querySelector('h3');
        var matches = !normalizedQuery || (title && title.textContent.toLowerCase().indexOf(normalizedQuery) !== -1);
        card.style.display = matches ? '' : 'none';
      });
    }

    async function loadCurrentUser() {
      try {
        var payload = await requestJson(USER_ME_API_URL);
        renderCurrentUser(payload.user || null);

        if (isAuthPage() && payload.user) {
          redirectAfterAuth();
        }
      } catch (error) {
        if (error.status !== 401 && error.status !== 404) {
          console.error(error);
        }

        renderCurrentUser(null);

        if (storePage === 'account') {
          redirectToAuthPage('login', 'Vui long dang nhap de xem trang tai khoan.', getPageUrl('account'));
        }
      }
    }

    async function handleLoginSubmit(event) {
      event.preventDefault();
      clearAccountFeedback();

      var email = getFieldValue('login-email');
      var password = getFieldValue('login-password', false);

      if (!email || !password) {
        setAccountFeedback('Vui long nhap du email va mat khau.', 'error');
        return;
      }

      toggleFormBusy(elements.loginForm, true);

      try {
        var payload = await requestJson(USER_LOGIN_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email, password: password })
        });

        renderCurrentUser(payload.user || null);
        if (elements.loginForm) elements.loginForm.reset();
        setAccountFeedback(payload.message || 'Dang nhap thanh cong.', 'success');
        redirectAfterAuth();
      } catch (error) {
        setAccountFeedback(error.message || 'Dang nhap that bai.', 'error');
      } finally {
        toggleFormBusy(elements.loginForm, false);
      }
    }

    async function handleRegisterSubmit(event) {
      event.preventDefault();
      clearAccountFeedback();

      var payload = {
        fullName: getFieldValue('register-full-name'),
        email: getFieldValue('register-email'),
        phone: getFieldValue('register-phone'),
        address: getFieldValue('register-address'),
        password: getFieldValue('register-password', false),
        confirmPassword: getFieldValue('register-confirm-password', false)
      };

      if (!payload.fullName || !payload.email || !payload.phone || !payload.address || !payload.password || !payload.confirmPassword) {
        setAccountFeedback('Vui long nhap du thong tin dang ky.', 'error');
        return;
      }

      if (payload.password !== payload.confirmPassword) {
        setAccountFeedback('Mat khau xac nhan khong khop.', 'error');
        return;
      }

      toggleFormBusy(elements.registerForm, true);

      try {
        var result = await requestJson(USER_REGISTER_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        renderCurrentUser(result.user || null);
        if (elements.registerForm) elements.registerForm.reset();
        setAccountFeedback(result.message || 'Tao tai khoan thanh cong.', 'success');
        redirectAfterAuth();
      } catch (error) {
        setAccountFeedback(error.message || 'Khong the tao tai khoan.', 'error');
      } finally {
        toggleFormBusy(elements.registerForm, false);
      }
    }

    async function handleLogoutSubmit() {
      clearAccountFeedback();

      try {
        await requestJson(USER_LOGOUT_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error(error);
      } finally {
        cart = [];
        saveCart();
        renderCurrentUser(null);
        redirectToStorePage('popular');
      }
    }

    function isAuthPage() {
      return storePage === 'auth' || storePage === 'login' || storePage === 'register';
    }

    function getAuthMode() {
      var searchParams = new window.URLSearchParams(window.location.search);
      var rawMode = String(searchParams.get('mode') || '').trim().toLowerCase();
      var pathname = String(window.location.pathname || '').toLowerCase();

      if (storePage === 'register' || pathname.slice(-9) === '/register' || rawMode === 'register') {
        return 'register';
      }

      return 'login';
    }

    function applyAuthMode() {
      if (!isAuthPage()) return;

      var authMode = getAuthMode();
      var showLogin = authMode !== 'register';

      if (elements.loginForm) {
        elements.loginForm.hidden = !showLogin;
        elements.loginForm.classList.toggle('is-active', showLogin);
      }

      if (elements.registerForm) {
        elements.registerForm.hidden = showLogin;
        elements.registerForm.classList.toggle('is-active', !showLogin);
      }
    }

    function renderCurrentUser(user) {
      var previousFavoriteScope = getFavoriteScope(currentUser);
      currentUser = user || null;
      if (getFavoriteScope(currentUser) !== previousFavoriteScope) {
        refreshFavoritesState();
      }

      document.body.classList.toggle('user-guest', !currentUser);

      if (elements.accountTriggerKicker) {
        elements.accountTriggerKicker.textContent = currentUser ? 'Xin chao' : 'Tai khoan';
      }

      if (elements.accountTriggerName) {
        elements.accountTriggerName.textContent = currentUser
          ? (currentUser.fullName || currentUser.email || 'Tai khoan')
          : 'Dang nhap / Dang ky';
      }

      if (elements.accountSessionCard) {
        elements.accountSessionCard.classList.toggle('d-none', !currentUser);
      }

      if (elements.accountHistoryCard) {
        elements.accountHistoryCard.classList.toggle('d-none', !currentUser);
      }

      if (elements.accountForms) {
        elements.accountForms.classList.toggle('d-none', !!currentUser);
      }

      if (!currentUser) {
        if (elements.sessionUserName) elements.sessionUserName.textContent = '-';
        if (elements.sessionUserEmail) elements.sessionUserEmail.textContent = '-';
        if (elements.sessionUserPhone) elements.sessionUserPhone.textContent = '-';
        if (elements.sessionUserAddress) elements.sessionUserAddress.textContent = '-';
        if (elements.accountOrderHistory) {
          elements.accountOrderHistory.innerHTML = '<p class="gallery-message is-empty">Dang nhap de xem lich su don hang.</p>';
        }
        resetCheckoutForm();
        return;
      }

      if (elements.sessionUserName) elements.sessionUserName.textContent = currentUser.fullName || 'Khach hang';
      if (elements.sessionUserEmail) elements.sessionUserEmail.textContent = currentUser.email || '-';
      if (elements.sessionUserPhone) elements.sessionUserPhone.textContent = currentUser.phone || '-';
      if (elements.sessionUserAddress) elements.sessionUserAddress.textContent = currentUser.address || '-';

      prefillCheckoutFromUser();
      loadUserOrders();
    }

    function prefillCheckoutFromUser() {
      if (!currentUser) return;
      fillInputIfEmpty('checkout-name', currentUser.fullName || '');
      fillInputIfEmpty('checkout-phone', currentUser.phone || '');
      fillInputIfEmpty('checkout-address', currentUser.address || '');
    }

    async function loadUserOrders() {
      if (!currentUser || !elements.accountOrderHistory) return;

      elements.accountOrderHistory.innerHTML = '<p class="gallery-message">Dang tai lich su don hang...</p>';

      try {
        var payload = await requestJson(USER_ORDERS_API_URL);
        renderUserOrders(payload.orders || []);
      } catch (error) {
        console.error(error);
        renderUserOrders([], error.message || 'Khong the tai lich su don hang.');
      }
    }

    function renderUserOrders(orders, errorMessage) {
      if (!elements.accountOrderHistory) return;

      if (errorMessage) {
        elements.accountOrderHistory.innerHTML = '<p class="gallery-message is-error">' + escapeHtml(errorMessage) + '</p>';
        return;
      }

      if (!Array.isArray(orders) || !orders.length) {
        elements.accountOrderHistory.innerHTML = '<p class="gallery-message is-empty">Ban chua co don hang nao.</p>';
        return;
      }

      elements.accountOrderHistory.innerHTML = orders.map(function (order) {
        var createdAt = order.createdAt ? new Date(order.createdAt) : null;
        var orderDate = createdAt && !Number.isNaN(createdAt.getTime())
          ? createdAt.toLocaleString('vi-VN')
          : '---';
        var itemCount = Array.isArray(order.items)
          ? order.items.reduce(function (sum, item) { return sum + Number(item.quantity || 0); }, 0)
          : 0;
        var paymentLabel = order.paymentMethod === 'bank' ? 'Chuyen khoan' : 'Thanh toan khi nhan hang';

        return [
          '<article class="account-history-item">',
          '  <div class="account-history-head">',
          '    <h4>' + escapeHtml(order.orderNumber || 'Don hang') + '</h4>',
          '    <span>' + escapeHtml(orderDate) + '</span>',
          '  </div>',
          '  <p>' + escapeHtml(paymentLabel) + ' • ' + escapeHtml(itemCount) + ' san pham</p>',
          '  <p>' + escapeHtml(order.customerAddress || currentUser.address || 'Chua cap nhat dia chi') + '</p>',
          '  <strong>' + escapeHtml(formatPrice(order.totalAmount || 0)) + '</strong>',
          '</article>'
        ].join('');
      }).join('');
    }

    function showProductDetail(product) {
      currentProduct = product || null;
      if (!currentProduct) return;

      if (elements.detailImage) {
        elements.detailImage.src = currentProduct.imageUrl || FALLBACK_IMAGE;
        elements.detailImage.alt = currentProduct.name || 'San pham';
        attachImageFallback(elements.detailImage, FALLBACK_IMAGE);
      }
      if (elements.detailCategory) elements.detailCategory.textContent = currentProduct.category || DEFAULT_CATEGORY;
      if (elements.detailName) elements.detailName.textContent = currentProduct.name || 'San pham';
      if (elements.detailPrice) elements.detailPrice.textContent = formatPrice(currentProduct.price);
      if (elements.detailDescription) {
        elements.detailDescription.textContent = currentProduct.description || 'Chua co mo ta chi tiet.';
      }
      if (elements.detailSku) elements.detailSku.textContent = currentProduct.sku || 'Dang cap nhat';
      if (elements.detailMaterial) elements.detailMaterial.textContent = currentProduct.material || 'Dang cap nhat';
      if (elements.detailWeight) elements.detailWeight.textContent = currentProduct.weight || 'Dang cap nhat';

      showOverlay('product-detail-modal');
    }

    function addToCart(product, options) {
      var nextProduct = product || null;
      if (!nextProduct) return false;

      if (!requireStorefrontLogin('Vui long dang nhap de them san pham vao gio hang.', options && options.sourceOverlayId)) {
        return false;
      }

      var existingItem = cart.find(function (item) {
        return String(item.id) === String(nextProduct.id);
      });

      if (existingItem) {
        existingItem.quantity += 1;
      } else {
        cart.push({
          id: nextProduct.id,
          name: nextProduct.name,
          imageUrl: nextProduct.imageUrl || FALLBACK_IMAGE,
          price: Number(nextProduct.price || 0),
          quantity: 1
        });
      }

      saveCart();
      updateCartDisplay();
      return true;
    }

    function removeFromCart(id) {
      cart = cart.filter(function (item) {
        return String(item.id) !== String(id);
      });
      saveCart();
      updateCartDisplay();
    }

    function updateCartDisplay() {
      var totalQuantity = Array.isArray(cart)
        ? cart.reduce(function (sum, item) { return sum + Number(item.quantity || 0); }, 0)
        : 0;
      var isCartEmpty = totalQuantity === 0;

      if (elements.cartCountEl) elements.cartCountEl.textContent = String(totalQuantity);

      if (elements.cartItemsEl) {
        elements.cartItemsEl.innerHTML = '';

        if (isCartEmpty) {
          elements.cartItemsEl.innerHTML = '<p class="gallery-message is-empty">Gio hang dang trong.</p>';
        } else {
          cart.forEach(function (item) {
            var itemEl = document.createElement('li');
            itemEl.className = 'cart-item';
            itemEl.innerHTML = [
              '<img src="' + escapeHtml(item.imageUrl || FALLBACK_IMAGE) + '" alt="' + escapeHtml(item.name) + '">',
              '<div class="cart-item-copy">',
              '  <strong>' + escapeHtml(item.name) + '</strong>',
              '  <div class="cart-item-price">' + escapeHtml(formatPrice(item.price)) + '</div>',
              '  <small class="text-muted">x ' + escapeHtml(item.quantity) + '</small>',
              '  <button class="cart-item-remove" type="button" data-id="' + escapeHtml(item.id) + '">Xoa</button>',
              '</div>'
            ].join('');

            var previewImage = itemEl.querySelector('img');
            if (previewImage) attachImageFallback(previewImage, FALLBACK_IMAGE);
            elements.cartItemsEl.appendChild(itemEl);
          });

          elements.cartItemsEl.querySelectorAll('.cart-item-remove').forEach(function (button) {
            button.addEventListener('click', function () {
              removeFromCart(button.dataset.id);
            });
          });
        }
      }

      var subtotal = cart.reduce(function (sum, item) {
        return sum + (Number(item.price || 0) * Number(item.quantity || 0));
      }, 0);

      if (elements.cartSubtotalEl) elements.cartSubtotalEl.textContent = formatPrice(subtotal);
      if (elements.cartTotalEl) elements.cartTotalEl.textContent = formatPrice(subtotal);
      if (elements.clearCartBtn) elements.clearCartBtn.disabled = isCartEmpty;
      if (elements.placeOrderBtn) {
        elements.placeOrderBtn.disabled = isCartEmpty;
        elements.placeOrderBtn.textContent = isCartEmpty ? 'Gio hang dang trong' : 'Hoan tat dat hang';
      }
      if (elements.checkoutForm) elements.checkoutForm.classList.toggle('is-disabled', isCartEmpty);
      if (elements.paymentCardEl) elements.paymentCardEl.classList.toggle('is-empty', isCartEmpty);
    }

    async function handleCheckout(event) {
      event.preventDefault();
      clearCheckoutFeedback();

      if (!requireStorefrontLogin('Vui long dang nhap de hoan tat dat hang.', 'cart-overlay')) {
        return;
      }

      if (cart.length === 0) {
        showCheckoutFeedback('Gio hang dang trong.', 'error');
        return;
      }

      var formData = new window.FormData(elements.checkoutForm);
      var name = String(formData.get('checkout-name') || '').trim();
      var phone = String(formData.get('checkout-phone') || '').trim();
      var address = String(formData.get('checkout-address') || '').trim();
      var payment = String(formData.get('checkout-payment') || '').trim();
      var resolvedName = name || (currentUser && currentUser.fullName) || '';
      var resolvedPhone = phone || (currentUser && currentUser.phone) || '';
      var resolvedAddress = address || (currentUser && currentUser.address) || '';

      if (!resolvedName || !resolvedPhone || !resolvedAddress) {
        showCheckoutFeedback('Vui long nhap du ho ten, so dien thoai va dia chi.', 'error');
        return;
      }

      if (!payment) {
        showCheckoutFeedback('Vui long chon phuong thuc thanh toan.', 'error');
        return;
      }

      if (payment === 'bank') {
        var cardNumber = getFieldValue('card-number');
        if (!cardNumber || cardNumber.length < 13) {
          showCheckoutFeedback('Vui long nhap so the hop le.', 'error');
          return;
        }
      }

      try {
        var payload = await requestJson(ORDERS_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerName: resolvedName,
            customerPhone: resolvedPhone,
            customerAddress: resolvedAddress,
            customerEmail: currentUser ? currentUser.email : '',
            paymentMethod: payment,
            notes: String(formData.get('checkout-notes') || ''),
            items: cart.map(function (item) {
              return {
                productId: item.id,
                quantity: item.quantity
              };
            })
          })
        });

        showCheckoutFeedback(payload.message || 'Dat hang thanh cong.', 'success');
        cart = [];
        saveCart();
        updateCartDisplay();
        resetCheckoutForm();
        loadUserOrders();

        window.setTimeout(function () {
          hideOverlay('cart-overlay');
        }, 1200);
      } catch (error) {
        if (error.status === 401) {
          requireStorefrontLogin(error.message || 'Vui long dang nhap de tiep tuc.', 'cart-overlay');
          return;
        }

        showCheckoutFeedback(error.message || 'Khong the xu ly don hang.', 'error');
      }
    }

    function initializePaymentMethod(method) {
      var selectedMethod = method === 'cod' ? 'cod' : 'bank';

      if (elements.paymentField) {
        elements.paymentField.value = selectedMethod;
      }

      elements.paymentButtons.forEach(function (button) {
        button.classList.toggle('active', button.dataset.method === selectedMethod);
      });

      if (elements.cardSection) {
        elements.cardSection.style.display = selectedMethod === 'bank' ? 'block' : 'none';
      }

      if (elements.shippingSection) {
        elements.shippingSection.style.display = 'block';
      }
    }

    function resetCheckoutForm() {
      if (elements.checkoutForm) elements.checkoutForm.reset();
      initializePaymentMethod('bank');
      prefillCheckoutFromUser();
      clearCheckoutFeedback();
    }

    function requireStorefrontLogin(message, sourceOverlayId) {
      if (currentUser) return true;

      if (sourceOverlayId) {
        hideOverlay(sourceOverlayId);
      }

      if (isAuthPage()) {
        setAccountFeedback(message || 'Vui long dang nhap de tiep tuc.', 'error');
        return false;
      }

      redirectToAuthPage('login', message || 'Vui long dang nhap de tiep tuc.', window.location.pathname + window.location.search);
      return false;
    }

    function showCheckoutFeedback(message, type) {
      if (!elements.checkoutFeedback) return;

      elements.checkoutFeedback.textContent = message || '';
      elements.checkoutFeedback.className = type === 'error'
        ? 'alert alert-danger mb-3'
        : 'alert alert-success mb-3';
      elements.checkoutFeedback.classList.remove('d-none');
    }

    function clearCheckoutFeedback() {
      if (!elements.checkoutFeedback) return;
      elements.checkoutFeedback.textContent = '';
      elements.checkoutFeedback.className = 'alert mb-3 d-none';
    }

    function setAccountFeedback(message, type) {
      if (!elements.accountFeedback) return;

      elements.accountFeedback.textContent = message || '';
      elements.accountFeedback.className = 'auth-feedback';

      if (type === 'success') elements.accountFeedback.classList.add('is-success');
      if (type === 'error') elements.accountFeedback.classList.add('is-error');
    }

    function clearAccountFeedback() {
      setAccountFeedback('', '');
    }

    function applyInitialMessage() {
      var searchParams = new window.URLSearchParams(window.location.search);
      var message = searchParams.get('message');
      var type = searchParams.get('type');

      if (!message) return;

      if (isAuthPage() || storePage === 'account') {
        setAccountFeedback(message, type === 'success' ? 'success' : 'error');
      } else {
        showCheckoutFeedback(message, type === 'success' ? 'success' : 'error');
      }
    }

    function toggleFormBusy(form, isBusy) {
      if (!form) return;
      form.querySelectorAll('button, input, textarea, select').forEach(function (field) {
        field.disabled = isBusy;
      });
    }

    function redirectAfterAuth() {
      var searchParams = new window.URLSearchParams(window.location.search);
      var returnTo = sanitizeReturnTo(searchParams.get('returnTo'));

      if (returnTo) {
        window.location.href = returnTo;
        return;
      }

      redirectToStorePage('account');
    }

    function redirectToAuthPage(page, message, returnTo) {
      var query = {};

      if (message) query.message = message;
      if (message) query.type = 'error';
      if (returnTo) query.returnTo = sanitizeReturnTo(returnTo) || returnTo;

      window.location.href = getPageUrl(page, query);
    }

    function redirectToStorePage(page, extraParams) {
      window.location.href = getPageUrl(page, extraParams || {});
    }

    function getPageUrl(page, params) {
      var routeMap = window.location.protocol === 'file:' ? FILE_ROUTES : STORE_ROUTES;
      var fallback = page === 'admin' ? STORE_ROUTES.admin : STORE_ROUTES.popular;
      var rawTarget = routeMap[page] || fallback;
      var targetUrl = new window.URL(rawTarget, window.location.href);
      var searchParams = new window.URLSearchParams(params || {});

      if (page === 'login') {
        searchParams.set('mode', 'login');
      }

      if (page === 'register') {
        searchParams.set('mode', 'register');
      }

      searchParams.forEach(function (value, key) {
        if (value === null || value === undefined || value === '') {
          searchParams.delete(key);
        }
      });

      targetUrl.search = searchParams.toString();
      return targetUrl.toString();
    }

    function sanitizeReturnTo(value) {
      var raw = String(value || '').trim();
      if (!raw) return '';

      var allowedPaths = Object.keys(STORE_ROUTES).reduce(function (acc, key) {
        acc[STORE_ROUTES[key]] = true;
        return acc;
      }, {});

      var allowedFiles = Object.keys(FILE_ROUTES).reduce(function (acc, key) {
        acc[FILE_ROUTES[key].replace('./', '')] = true;
        return acc;
      }, {});

      try {
        var parsed = new window.URL(raw, window.location.href);
        if (window.location.protocol === 'file:') {
          var fileName = parsed.pathname.split('/').pop();
          return allowedFiles[fileName] ? fileName + parsed.search : '';
        }

        if (parsed.origin !== window.location.origin) return '';
        return allowedPaths[parsed.pathname] ? parsed.pathname + parsed.search : '';
      } catch (error) {
        if (allowedPaths[raw]) return raw;
        if (allowedFiles[raw]) return raw;
        return '';
      }
    }

    function showOverlay(id) {
      var overlay = document.getElementById(id);
      if (!overlay) return;

      overlay.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    }

    function hideOverlay(id) {
      var overlay = document.getElementById(id);
      if (!overlay) return;

      overlay.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }

    async function requestJson(url, options) {
      var init = Object.assign({}, options || {});

      if (!init.credentials) {
        init.credentials = 'same-origin';
      }

      var response = await window.fetch(buildApiUrl(url), init);
      var text = await response.text();
      var payload = {};

      if (text) {
        try {
          payload = JSON.parse(text);
        } catch (error) {
          payload = /<!doctype html/i.test(text)
            ? { message: 'API chua san sang. Hay khoi dong lai backend bang server-main.js.' }
            : { message: text };
        }
      }

      if (!response.ok) {
        var requestError = new Error(payload.message || ('Request failed with status ' + response.status));
        requestError.status = response.status;
        requestError.payload = payload;
        throw requestError;
      }

      return payload;
    }

    function fetchJson(url) {
      return requestJson(url);
    }

    function buildApiUrl(path) {
      return apiClient && typeof apiClient.buildApiUrl === 'function'
        ? apiClient.buildApiUrl(path)
        : path;
    }

    function resolveAssetUrl(path) {
      return apiClient && typeof apiClient.resolveAssetUrl === 'function'
        ? apiClient.resolveAssetUrl(path)
        : path;
    }

    function saveCart() {
      writeStorage(CART_STORAGE_KEY, cart);
    }

    function readStorage(key, fallback) {
      try {
        var rawValue = window.localStorage.getItem(key);
        return rawValue ? JSON.parse(rawValue) : fallback;
      } catch (error) {
        return fallback;
      }
    }

    function writeStorage(key, value) {
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch (error) {
        console.error(error);
      }
    }

    function getFieldValue(id, trimValue) {
      var field = document.getElementById(id);
      var value = field ? String(field.value || '') : '';
      return trimValue === false ? value : value.trim();
    }

    function fillInputIfEmpty(id, value) {
      var field = document.getElementById(id);
      if (!field || field.value) return;
      field.value = String(value || '');
    }

    function formatPrice(price) {
      return new window.Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND'
      }).format(Number(price || 0));
    }

    function truncateText(value, limit) {
      var text = String(value || '');
      return text.length > limit ? text.slice(0, limit - 1) + '…' : text;
    }

    function escapeHtml(value) {
      return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function attachImageFallback(image, fallbackSrc) {
      if (!image) return;

      image.addEventListener('error', function handleImageError() {
        if (image.src.indexOf(fallbackSrc) !== -1) return;
        image.src = fallbackSrc;
      }, { once: true });
    }
  });
}(window, document));
