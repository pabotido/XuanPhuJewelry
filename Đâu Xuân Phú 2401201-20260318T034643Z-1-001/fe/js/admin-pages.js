const ADMIN_API_URL = '/api/products';
const ADMIN_ORDERS_API_URL = '/api/orders';
const ADMIN_USERS_API_URL = '/api/admin/users';
const ADMIN_RESET_PASSWORD_API_SUFFIX = '/reset-password';
const ADMIN_ALLOWED_CATEGORIES = ['Phổ biến', 'Mới nhất', 'Pho bien', 'Moi nhat', 'Phá»• biáº¿n', 'Má»›i nháº¥t'];
const ADMIN_MAX_UPLOAD_SIZE = 5 * 1024 * 1024;
const ADMIN_FALLBACK_IMAGE = '/img/image.png';
const ADMIN_SECTION_META = {
    products: {
        label: 'He thong quan ly / San pham',
        description: 'Theo doi du lieu san pham, cap nhat noi dung va xu ly hinh anh tu page products rieng.',
        actionVisible: true
    },
    orders: {
        label: 'He thong quan ly / Don hang',
        description: 'Kiem tra thong tin nguoi mua, thanh toan, trang thai va tong gia tri tu page orders rieng.',
        actionVisible: false
    },
    users: {
        label: 'He thong quan ly / Tai khoan',
        description: 'Theo doi thong tin lien he, tong chi tieu va lich su dat hang cua tung tai khoan.',
        actionVisible: false
    }
};

const adminApiClient = window.XuanPhuApi || null;
let adminModal;
let adminPreviewObjectUrl = null;
let adminDashboardReady = false;

function getAdminSection() {
    return document.body.dataset.adminSection || 'products';
}

function isAdminLoginPage() {
    return getAdminSection() === 'login';
}

function getAdminPageUrl(section, params) {
    const sameOrigin = adminApiClient && typeof adminApiClient.isSameOriginApi === 'function'
        ? adminApiClient.isSameOriginApi()
        : window.location.protocol !== 'file:';
    const routeMap = sameOrigin
        ? {
            login: '/admin/login',
            orders: '/admin/orders',
            products: '/admin',
            users: '/admin/users'
        }
        : {
            login: './login.html',
            orders: './orders.html',
            products: './products.html',
            users: './users.html'
        };
    const target = new URL(routeMap[section] || routeMap.products, window.location.href);
    const searchParams = new URLSearchParams(params || {});
    target.search = searchParams.toString();
    return target.toString();
}

function sanitizeAdminReturnTo(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';

    const allowedPaths = {
        '/admin': true,
        '/admin/login': true,
        '/admin/orders': true,
        '/admin/users': true
    };
    const allowedFiles = {
        'login.html': true,
        'orders.html': true,
        'products.html': true,
        'users.html': true
    };

    try {
        const parsed = new URL(raw, window.location.href);

        if (window.location.protocol === 'file:') {
            const fileName = parsed.pathname.split('/').pop();
            return allowedFiles[fileName] ? fileName + parsed.search : '';
        }

        if (parsed.origin !== window.location.origin) return '';
        return allowedPaths[parsed.pathname] ? parsed.pathname + parsed.search : '';
    } catch {
        if (allowedPaths[raw] || allowedFiles[raw]) return raw;
        return '';
    }
}

function getAdminAuthElements() {
    return {
        authGate: document.getElementById('admin-auth-gate'),
        feedback: document.getElementById('admin-inline-login-feedback'),
        form: document.getElementById('admin-inline-login-form'),
        pageShell: document.getElementById('admin-page-shell'),
        password: document.getElementById('admin-inline-password'),
        username: document.getElementById('admin-inline-username')
    };
}

document.addEventListener('DOMContentLoaded', async () => {
    if (document.body.dataset.page !== 'admin') return;

    bindAdminInlineLoginEvents();

    const isAuthenticated = await checkAdminSession();
    setAdminAuthState(isAuthenticated);

    if (isAuthenticated) {
        if (isAdminLoginPage()) {
            window.location.href = getAdminPageUrl('products');
            return;
        }

        await initAdminDashboard();
        return;
    }

    if (!isAdminLoginPage()) {
        window.location.href = getAdminPageUrl('login', {
            returnTo: sanitizeAdminReturnTo(getAdminPageUrl(getAdminSection()))
        });
    }
});

function bindAdminInlineLoginEvents() {
    const auth = getAdminAuthElements();
    if (!auth.form || !auth.feedback || !auth.username || !auth.password) return;

    auth.form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const username = auth.username.value.trim();
        const password = auth.password.value;

        if (!username || !password) {
            auth.feedback.textContent = 'Vui long nhap du tai khoan va mat khau.';
            auth.feedback.className = 'admin-inline-feedback is-error';
            return;
        }

        auth.feedback.textContent = 'Dang dang nhap...';
        auth.feedback.className = 'admin-inline-feedback';

        try {
            const response = await fetch(buildAdminApiUrl('/api/admin/login'), buildAdminRequestInit({
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            }));
            await handleAdminJsonResponse(response);

            auth.feedback.textContent = 'Dang nhap thanh cong.';
            auth.feedback.className = 'admin-inline-feedback is-success';
            setAdminAuthState(true);

            const searchParams = new URLSearchParams(window.location.search);
            const returnTo = sanitizeAdminReturnTo(searchParams.get('returnTo'));
            window.location.href = returnTo || getAdminPageUrl('products');
        } catch (error) {
            auth.feedback.textContent = error.message || 'Dang nhap that bai.';
            auth.feedback.className = 'admin-inline-feedback is-error';
        }
    });
}

function setAdminAuthState(isAuthenticated) {
    const auth = getAdminAuthElements();

    if (auth.authGate) {
        auth.authGate.hidden = !!isAuthenticated;
    }

    if (auth.pageShell) {
        auth.pageShell.hidden = !isAuthenticated;
    }

    if (!isAuthenticated && auth.password) {
        auth.password.value = '';
    }
}

async function checkAdminSession() {
    try {
        const response = await fetch(buildAdminApiUrl('/api/admin/session'), buildAdminRequestInit());
        const payload = await response.json().catch(() => ({}));
        return Boolean(response.ok && payload.authenticated);
    } catch {
        return false;
    }
}

async function initAdminDashboard() {
    if (adminDashboardReady) return;

    const modalElement = document.getElementById('productModal');
    if (modalElement && typeof bootstrap !== 'undefined') {
        adminModal = new bootstrap.Modal(modalElement);
    }

    bindAdminEvents(modalElement);
    initAdminTabs();

    adminDashboardReady = true;
    await loadAdminSection(getAdminSection());
}

function initAdminTabs() {
    switchAdminTab(getAdminSection());
}

async function loadAdminSection(section) {
    if (section === 'products' && typeof fetchAdminProducts === 'function') {
        await fetchAdminProducts();
    }

    if (section === 'orders' && typeof fetchAdminOrders === 'function') {
        await fetchAdminOrders();
    }

    if (section === 'users' && typeof fetchAdminUsers === 'function') {
        await fetchAdminUsers();
    }
}

function switchAdminTab(section) {
    const tabButtons = document.querySelectorAll('.admin-tabs .tab');
    const tabContents = document.querySelectorAll('.tab-content');
    const label = document.getElementById('admin-current-label');
    const description = document.getElementById('admin-current-description');
    const primaryAction = document.getElementById('admin-primary-action');
    const meta = ADMIN_SECTION_META[section] || ADMIN_SECTION_META.products;

    tabButtons.forEach((button) => {
        button.classList.toggle('active', button.dataset.section === section);
    });

    tabContents.forEach((content) => {
        content.classList.toggle('active', content.id === `${section}-tab`);
    });

    if (label) label.textContent = meta.label;
    if (description) description.textContent = meta.description;
    if (primaryAction) primaryAction.style.display = meta.actionVisible ? '' : 'none';
}

function bindAdminEvents(modalElement) {
    const saveButton = document.getElementById('save-product');
    if (saveButton) {
        saveButton.addEventListener('click', () => {
            if (typeof saveAdminProduct === 'function') {
                saveAdminProduct();
            }
        });
    }

    const primaryAction = document.getElementById('admin-primary-action');
    if (primaryAction) {
        primaryAction.addEventListener('click', () => {
            if (getAdminSection() !== 'products') return;
            if (typeof openAddModal === 'function') {
                openAddModal();
            }
        });
    }

    const logoutButton = document.getElementById('admin-logout');
    if (logoutButton) {
        logoutButton.addEventListener('click', logoutAdmin);
    }

    const imageUrlInput = document.getElementById('prod-img');
    const fileInput = document.getElementById('prod-file');

    if (imageUrlInput) {
        imageUrlInput.addEventListener('input', () => {
            if (fileInput?.files?.length) return;
            if (typeof syncAdminPreviewFromInputs === 'function') {
                syncAdminPreviewFromInputs();
            }
        });
    }

    if (fileInput) {
        fileInput.addEventListener('change', () => {
            if (fileInput.files?.length) {
                if (typeof updateAdminPreviewFromFile === 'function') {
                    updateAdminPreviewFromFile(fileInput.files[0]);
                }
            } else if (typeof syncAdminPreviewFromInputs === 'function') {
                syncAdminPreviewFromInputs();
            }
        });
    }

    if (modalElement) {
        modalElement.addEventListener('hidden.bs.modal', () => {
            clearAdminPreviewObjectUrl();
        });
    }
}

function getAdminModal() {
    return adminModal;
}

function setAdminPreviewObjectUrl(value) {
    adminPreviewObjectUrl = value;
}

function clearAdminPreviewObjectUrl() {
    if (!adminPreviewObjectUrl) return;
    URL.revokeObjectURL(adminPreviewObjectUrl);
    adminPreviewObjectUrl = null;
}

function writeAdminFeedback(message, type) {
    const feedback = document.getElementById('admin-feedback');
    if (!feedback) return;

    feedback.textContent = message || '';
    feedback.className = 'admin-feedback';
    if (type === 'success') feedback.classList.add('is-success');
    if (type === 'error') feedback.classList.add('is-error');
}

function formatAdminCurrency(value) {
    const amount = Number.isFinite(Number(value)) ? Number(value) : 0;
    return new Intl.NumberFormat('vi-VN', {
        currency: 'VND',
        style: 'currency'
    }).format(amount);
}

function renderAdminStatusBadge(status) {
    const normalized = String(status || 'pending').toLowerCase();
    const statusMap = {
        pending: { label: 'Cho xu ly', className: 'admin-badge is-muted' },
        success: { label: 'Thanh cong', className: 'admin-badge is-success' },
        completed: { label: 'Hoan tat', className: 'admin-badge is-success' },
        paid: { label: 'Da thanh toan', className: 'admin-badge is-success' }
    };
    const current = statusMap[normalized] || { label: normalized, className: 'admin-badge is-alt' };
    return `<span class="${current.className}">${escapeAdminHtml(current.label)}</span>`;
}

function truncateAdminText(value, maxLength) {
    if (!value || value.length <= maxLength) return value || '';
    return `${value.slice(0, maxLength).trim()}...`;
}

function attachAdminImageFallback(img, fallbackSrc) {
    img.addEventListener('error', function handleError() {
        if (img.src.indexOf(fallbackSrc) !== -1) return;
        img.src = fallbackSrc;
    }, { once: true });
}

function escapeAdminHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatAdminDateTime(value) {
    const date = value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime())
        ? date.toLocaleString('vi-VN')
        : '---';
}

function buildAdminApiUrl(path) {
    return adminApiClient ? adminApiClient.buildApiUrl(path) : path;
}

function buildAdminRequestInit(options) {
    return adminApiClient ? adminApiClient.createAdminRequestInit(options) : (options || {});
}

function resolveAdminAssetUrl(path) {
    return adminApiClient ? (adminApiClient.resolveAssetUrl(path) || ADMIN_FALLBACK_IMAGE) : (path || ADMIN_FALLBACK_IMAGE);
}

function clearAdminAuthAndRedirect() {
    if (adminApiClient) {
        adminApiClient.clearAdminToken();
    }

    adminDashboardReady = false;
    setAdminAuthState(false);
    window.location.href = getAdminPageUrl('login', {
        returnTo: sanitizeAdminReturnTo(getAdminPageUrl(getAdminSection()))
    });
}

async function handleAdminJsonResponse(response) {
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        if (response.status === 401 && !isAdminLoginPage()) {
            clearAdminAuthAndRedirect();
        }
        throw new Error(payload.message || `Request failed with status ${response.status}`);
    }
    return payload;
}

async function logoutAdmin() {
    try {
        await fetch(buildAdminApiUrl('/api/admin/logout'), buildAdminRequestInit({ method: 'POST' }));
    } catch (error) {
        console.error(error);
    } finally {
        clearAdminAuthAndRedirect();
    }
}
