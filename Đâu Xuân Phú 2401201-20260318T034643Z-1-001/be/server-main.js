const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');

const cors = require('cors');
const express = require('express');
const mssql = require('mssql');
const { createDbPoolManager } = require('./db-pool');
const { createUserAuth } = require('./auth/user-auth');

const app = express();

const PORT = 3000;
const FRONTEND_DIR = path.join(__dirname, '..', 'fe');
const DATA_DIR = path.join(__dirname, 'data');
const PRODUCT_METADATA_FILE = path.join(DATA_DIR, 'product-metadata.json');
const ORDER_FILE = path.join(DATA_DIR, 'orders.json');
const PRODUCT_UPLOAD_DIR = path.join(FRONTEND_DIR, 'uploads', 'products');
const PRODUCT_UPLOAD_PREFIX = '/uploads/products/';

const ALLOWED_CATEGORIES = ['Phá»• biáº¿n', 'Má»›i nháº¥t'];
const CATEGORY_LABELS = {
    latest: 'Mới nhất',
    popular: 'Phổ biến'
};
const CATEGORY_ALIASES = {
    latest: 'latest',
    'má»›i nháº¥t': 'latest',
    'moi nhat': 'latest',
    'mới nhất': 'latest',
    popular: 'popular',
    'phá»• biáº¿n': 'popular',
    'pho bien': 'popular',
    'phổ biến': 'popular'
};
const ALLOWED_UPLOAD_MIME_TYPES = {
    'image/gif': 'gif',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp'
};

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'XuanPhu@2026';
const ADMIN_COOKIE_NAME = 'xuanphu_admin';
const USER_COOKIE_NAME = 'xuanphu_user';
const ADMIN_SESSION_TOKEN = crypto
    .createHash('sha256')
    .update(`${ADMIN_USERNAME}:${ADMIN_PASSWORD}:xuanphu-local-session`)
    .digest('hex');
const PASSWORD_HASH_ITERATIONS = 120000;
const PASSWORD_HASH_KEY_LENGTH = 64;
const PASSWORD_HASH_DIGEST = 'sha512';

const MAX_UPLOAD_SIZE = 5 * 1024 * 1024;
const DEFAULT_CURRENCY = 'VND';

// Database connection settings for SQL Server.
const dbConfig = {
    user: 'sa',
    password: '123456789',
    server: 'LAPTOP-5JFTF2UJ\\SQLEXPRESS',  // ✅ Tên server đầy đủ
    database: 'XuanPhuGold',
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

const db = createDbPoolManager(mssql, dbConfig);
const userAuth = createUserAuth({ mssql, db });

const USER_SELECT_FIELDS = `
    SELECT
        u.id AS Id,
        u.username AS Username,
        u.email AS Email,
        u.password_hash AS PasswordHash,
        u.password_salt AS PasswordSalt,
        u.is_active AS IsActive,
        u.created_at AS CreatedAt,
        u.updated_at AS UpdatedAt,
        p.full_name AS FullName,
        p.phone_number AS Phone,
        p.address AS Address
    FROM [Users] AS u
    LEFT JOIN [UserProfiles] AS p
        ON p.id = u.id
`;

app.use(cors());
app.use(express.urlencoded({ extended: false }));
app.use(express.json({ limit: '8mb' }));

function parseCookies(req) {
    const header = req.headers.cookie || '';
    return header.split(';').reduce((acc, entry) => {
        const [rawKey, ...rawValue] = entry.trim().split('=');
        if (!rawKey) return acc;
        acc[rawKey] = decodeURIComponent(rawValue.join('='));
        return acc;
    }, {});
}

function isAdminAuthenticated(req) {
    const cookies = parseCookies(req);
    return cookies[ADMIN_COOKIE_NAME] === ADMIN_SESSION_TOKEN;
}

function hasValidAdminCredentials(username, password) {
    return username === ADMIN_USERNAME && password === ADMIN_PASSWORD;
}

function normalizeEmail(rawValue) {
    return typeof rawValue === 'string' ? rawValue.trim().toLowerCase() : '';
}

function normalizePhone(rawValue) {
    return typeof rawValue === 'string' ? rawValue.replace(/\s+/g, '').trim() : '';
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(phone) {
    return /^[0-9+().-]{8,20}$/.test(phone);
}

function createPasswordSalt() {
    return crypto.randomBytes(16).toString('hex');
}

function hashPassword(password, salt) {
    return crypto
        .pbkdf2Sync(password, salt, PASSWORD_HASH_ITERATIONS, PASSWORD_HASH_KEY_LENGTH, PASSWORD_HASH_DIGEST)
        .toString('hex');
}

function isUserActive(user) {
    return Boolean(user) && user.IsActive !== false && user.IsActive !== 0;
}

function createUserSessionToken(user) {
    return crypto
        .createHash('sha256')
        .update(`${user.Id}:${user.Email}:${user.PasswordHash}:xuanphu-user-session`)
        .digest('hex');
}

function buildUserCookieValue(user) {
    return `${user.Id}.${createUserSessionToken(user)}`;
}

function setUserCookie(res, user) {
    res.cookie(USER_COOKIE_NAME, buildUserCookieValue(user), {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000
    });
}

function clearUserCookie(res) {
    res.clearCookie(USER_COOKIE_NAME, {
        httpOnly: true,
        sameSite: 'lax'
    });
}

function toPublicUser(user) {
    return {
        id: user.Id,
        fullName: user.FullName,
        email: user.Email,
        phone: user.Phone || '',
        address: user.Address || '',
        createdAt: user.CreatedAt
    };
}

function validateUserRegisterPayload(body) {
    const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : '';
    const email = normalizeEmail(body.email);
    const phone = normalizePhone(body.phone);
    const address = typeof body.address === 'string' ? body.address.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const confirmPassword = typeof body.confirmPassword === 'string' ? body.confirmPassword : '';

    if (fullName.length < 2) {
        return { error: 'Há» tÃªn pháº£i cÃ³ Ã­t nháº¥t 2 kÃ½ tá»±.' };
    }

    if (!isValidEmail(email)) {
        return { error: 'Email khÃ´ng há»£p lá»‡.' };
    }

    if (!isValidPhone(phone)) {
        return { error: 'Sá»‘ Ä‘iá»‡n thoáº¡i khÃ´ng há»£p lá»‡.' };
    }

    if (!address) {
        return { error: 'Äá»‹a chá»‰ nháº­n hÃ ng lÃ  báº¯t buá»™c.' };
    }

    if (password.length < 6) {
        return { error: 'Máº­t kháº©u pháº£i cÃ³ Ã­t nháº¥t 6 kÃ½ tá»±.' };
    }

    if (confirmPassword && password !== confirmPassword) {
        return { error: 'Máº­t kháº©u xÃ¡c nháº­n khÃ´ng khá»›p.' };
    }

    return {
        address,
        email,
        fullName,
        password,
        phone
    };
}

function validateUserLoginPayload(body) {
    const email = normalizeEmail(body.email);
    const password = typeof body.password === 'string' ? body.password : '';

    if (!isValidEmail(email)) {
        return { error: 'Email khÃ´ng há»£p lá»‡.' };
    }

    if (!password) {
        return { error: 'Máº­t kháº©u lÃ  báº¯t buá»™c.' };
    }

    return { email, password };
}

function requireAdminApi(req, res, next) {
    if (isAdminAuthenticated(req)) {
        return next();
    }

    return res.status(401).json({ message: 'Báº¡n cáº§n Ä‘Äƒng nháº­p admin.' });
}

function setAdminCookie(res) {
    res.cookie(ADMIN_COOKIE_NAME, ADMIN_SESSION_TOKEN, {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 8 * 60 * 60 * 1000
    });
}

function clearAdminCookie(res) {
    res.clearCookie(ADMIN_COOKIE_NAME, {
        httpOnly: true,
        sameSite: 'lax'
    });
}

function sendFrontendPage(res, ...segments) {
    res.set('Cache-Control', 'no-store');
    res.sendFile(path.join(FRONTEND_DIR, ...segments));
}

function parseProductId(rawId) {
    const id = Number.parseInt(rawId, 10);
    return Number.isInteger(id) && id > 0 ? id : null;
}

function parsePositiveMoney(rawValue) {
    if (rawValue === '' || rawValue === null || rawValue === undefined) return null;
    const numeric = Number(rawValue);
    if (!Number.isFinite(numeric) || numeric < 0) return null;
    return Math.round(numeric);
}

function sanitizeUploadBaseName(fileName) {
    const baseName = path.basename(fileName, path.extname(fileName));
    const safe = baseName.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
    return safe || 'product';
}

function buildManagedUploadUrl(fileName) {
    return `${PRODUCT_UPLOAD_PREFIX}${fileName}`;
}

function isManagedUploadUrl(imageUrl) {
    return typeof imageUrl === 'string' && imageUrl.startsWith(PRODUCT_UPLOAD_PREFIX);
}

function normalizeUploadedImage(rawImage) {
    if (!rawImage) return null;
    if (typeof rawImage !== 'object') {
        return { error: 'Dá»¯ liá»‡u áº£nh upload khÃ´ng há»£p lá»‡.' };
    }

    const fileName = typeof rawImage.fileName === 'string' ? rawImage.fileName.trim() : '';
    const mimeType = typeof rawImage.mimeType === 'string' ? rawImage.mimeType.trim() : '';
    const dataUrl = typeof rawImage.dataUrl === 'string' ? rawImage.dataUrl.trim() : '';
    const extension = ALLOWED_UPLOAD_MIME_TYPES[mimeType];

    if (!fileName || !mimeType || !dataUrl) {
        return { error: 'Thiáº¿u thÃ´ng tin file áº£nh upload.' };
    }

    if (!extension) {
        return { error: 'Äá»‹nh dáº¡ng áº£nh upload chÆ°a Ä‘Æ°á»£c há»— trá»£.' };
    }

    const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/);
    if (!match || match[1] !== mimeType) {
        return { error: 'Ná»™i dung file áº£nh upload khÃ´ng há»£p lá»‡.' };
    }

    const buffer = Buffer.from(match[2], 'base64');
    if (!buffer.length || buffer.length > MAX_UPLOAD_SIZE) {
        return { error: 'áº¢nh upload vÆ°á»£t quÃ¡ giá»›i háº¡n 5MB.' };
    }

    return { buffer, extension, fileName };
}

function normalizeProductMetadata(rawMetadata) {
    const metadata = rawMetadata && typeof rawMetadata === 'object' ? rawMetadata : {};
    const price = parsePositiveMoney(metadata.price);
    const description = typeof metadata.description === 'string' ? metadata.description.trim() : '';
    const material = typeof metadata.material === 'string' ? metadata.material.trim() : '';
    const sku = typeof metadata.sku === 'string' ? metadata.sku.trim() : '';
    const weight = typeof metadata.weight === 'string' ? metadata.weight.trim() : '';

    if (price === null) {
        return { error: 'GiÃ¡ sáº£n pháº©m khÃ´ng há»£p lá»‡.' };
    }

    return {
        currency: DEFAULT_CURRENCY,
        description,
        material,
        price,
        sku,
        weight
    };
}

function normalizeCategoryKey(rawValue) {
    if (typeof rawValue !== 'string') return '';

    const directValue = rawValue.trim().toLowerCase();
    if (!directValue) return '';

    if (CATEGORY_ALIASES[directValue]) {
        return CATEGORY_ALIASES[directValue];
    }

    const compactValue = directValue
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    return CATEGORY_ALIASES[compactValue] || '';
}

function normalizeCategoryValue(rawValue) {
    const categoryKey = normalizeCategoryKey(rawValue);
    return categoryKey ? CATEGORY_LABELS[categoryKey] : '';
}

function validateProductPayload(body) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const imageUrl = typeof body.imageUrl === 'string' ? body.imageUrl.trim() : '';
    const category = normalizeCategoryValue(body.category) || CATEGORY_LABELS.popular;
    const uploadedImage = normalizeUploadedImage(body.uploadedImage);
    const metadata = normalizeProductMetadata(body.metadata);

    if (!name) {
        return { error: 'TÃªn sáº£n pháº©m lÃ  báº¯t buá»™c.' };
    }

    if (uploadedImage?.error) {
        return { error: uploadedImage.error };
    }

    if (!imageUrl && !uploadedImage) {
        return { error: 'Link áº£nh hoáº·c file áº£nh lÃ  báº¯t buá»™c.' };
    }

    if (metadata?.error) {
        return { error: metadata.error };
    }

    return {
        category,
        imageUrl,
        metadata,
        name,
        uploadedImage
    };
}

async function ensureJsonFile(filePath, fallbackValue) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    try {
        await fs.access(filePath);
    } catch {
        await fs.writeFile(filePath, JSON.stringify(fallbackValue, null, 2));
    }
}

async function readJsonFile(filePath, fallbackValue) {
    await ensureJsonFile(filePath, fallbackValue);
    const raw = await fs.readFile(filePath, 'utf8');

    try {
        return JSON.parse(raw);
    } catch {
        return fallbackValue;
    }
}

async function writeJsonFile(filePath, value) {
    await ensureJsonFile(filePath, value);
    await fs.writeFile(filePath, JSON.stringify(value, null, 2));
}

async function readProductMetadataMap() {
    return readJsonFile(PRODUCT_METADATA_FILE, {});
}

async function writeProductMetadataMap(value) {
    return writeJsonFile(PRODUCT_METADATA_FILE, value);
}

async function appendOrder(order) {
    const orders = await readJsonFile(ORDER_FILE, []);
    orders.push(order);
    await writeJsonFile(ORDER_FILE, orders);
    return order;
}

async function readOrders() {
    return readJsonFile(ORDER_FILE, []);
}

async function writeOrders(value) {
    return writeJsonFile(ORDER_FILE, value);
}

async function persistUploadedImage(uploadedImage) {
    await fs.mkdir(PRODUCT_UPLOAD_DIR, { recursive: true });
    const safeName = sanitizeUploadBaseName(uploadedImage.fileName).slice(0, 40);
    const finalFileName = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}-${safeName}.${uploadedImage.extension}`;
    const absolutePath = path.join(PRODUCT_UPLOAD_DIR, finalFileName);

    await fs.writeFile(absolutePath, uploadedImage.buffer);
    return buildManagedUploadUrl(finalFileName);
}

async function deleteManagedProductImage(imageUrl) {
    if (!isManagedUploadUrl(imageUrl)) return;

    const fileName = path.basename(imageUrl);
    const absolutePath = path.resolve(PRODUCT_UPLOAD_DIR, fileName);
    const uploadRoot = path.resolve(PRODUCT_UPLOAD_DIR);
    if (!absolutePath.startsWith(uploadRoot)) return;

    try {
        await fs.unlink(absolutePath);
    } catch (error) {
        if (error.code !== 'ENOENT') {
            console.error('[UPLOAD_DELETE_ERROR]', error);
        }
    }
}

async function getProductById(id) {
    const result = await db.request((pool) => pool.request()
        .input('id', mssql.Int, id)
        .query('SELECT TOP 1 * FROM Products WHERE Id = @id'));

    return result.recordset[0] || null;
}

async function getUserById(id) {
    const result = await db.request((pool) => pool.request()
        .input('id', mssql.BigInt, id)
        .query(`${USER_SELECT_FIELDS} WHERE u.id = @id`));

    return result.recordset[0] || null;
}

async function getUserByEmail(email) {
    const result = await db.request((pool) => pool.request()
        .input('email', mssql.NVarChar(255), email)
        .query(`${USER_SELECT_FIELDS} WHERE u.email = @email`));

    return result.recordset[0] || null;
}

async function getUserByPhone(phone) {
    const result = await db.request((pool) => pool.request()
        .input('phone', mssql.NVarChar(50), phone)
        .query(`${USER_SELECT_FIELDS} WHERE p.phone_number = @phone`));

    return result.recordset[0] || null;
}

async function getAllUsers() {
    const result = await db.request((pool) => pool.request()
        .query(`${USER_SELECT_FIELDS} ORDER BY u.created_at DESC, u.id DESC`));

    return result.recordset;
}

async function getAuthenticatedUser(req) {
    const cookies = parseCookies(req);
    const rawCookie = typeof cookies[USER_COOKIE_NAME] === 'string' ? cookies[USER_COOKIE_NAME] : '';
    const [rawId, token] = rawCookie.split('.');
    const id = parseProductId(rawId);

    if (!id || !token) {
        return null;
    }

    const user = await getUserById(id);
    if (!isUserActive(user)) {
        return null;
    }

    return createUserSessionToken(user) === token ? user : null;
}

function sortOrdersByCreatedAtDesc(orders) {
    return [...orders].sort((left, right) => {
        const leftTime = Date.parse(left?.createdAt || 0) || 0;
        const rightTime = Date.parse(right?.createdAt || 0) || 0;
        return rightTime - leftTime;
    });
}

function filterOrdersForUser(orders, user) {
    const normalizedEmail = normalizeEmail(user?.Email);
    const userId = Number(user?.Id || 0);

    return sortOrdersByCreatedAtDesc((Array.isArray(orders) ? orders : []).filter((order) => {
        const orderUserId = Number(order?.userId || 0);
        const orderEmail = normalizeEmail(order?.customerEmail);
        return (userId > 0 && orderUserId === userId) || (!!normalizedEmail && orderEmail === normalizedEmail);
    }));
}

function buildUserAdminView(user, orders) {
    const userOrders = filterOrdersForUser(orders, user);
    const totalSpent = userOrders.reduce((sum, order) => sum + Number(order?.totalAmount || 0), 0);

    return {
        id: user.Id,
        username: user.Username || '',
        fullName: user.FullName,
        email: user.Email,
        phone: user.Phone || '',
        address: user.Address || '',
        isActive: isUserActive(user),
        createdAt: user.CreatedAt,
        updatedAt: user.UpdatedAt,
        orderCount: userOrders.length,
        totalSpent,
        lastOrderAt: userOrders[0]?.createdAt || null,
        orders: userOrders
    };
}

async function getMergedProducts() {
    const [productResult, metadataMap] = await Promise.all([
        db.request((pool) => pool.request().query('SELECT * FROM Products ORDER BY Id DESC')),
        readProductMetadataMap()
    ]);

    return productResult.recordset.map((product) => {
        const metadata = metadataMap[String(product.Id)] || {};
        return {
            ...product,
            Currency: metadata.currency || DEFAULT_CURRENCY,
            Description: metadata.description || '',
            Material: metadata.material || '',
            Price: Number.isFinite(metadata.price) ? metadata.price : 0,
            Sku: metadata.sku || '',
            Weight: metadata.weight || ''
        };
    });
}

function buildOrderNumber() {
    return `XP-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
}

function validateCheckoutPayload(body, productsById, userProfile) {
    const customerNameInput = typeof body.customerName === 'string' ? body.customerName.trim() : '';
    const customerPhoneInput = typeof body.customerPhone === 'string' ? body.customerPhone.trim() : '';
    const customerAddressInput = typeof body.customerAddress === 'string' ? body.customerAddress.trim() : '';
    const customerName = customerNameInput || userProfile?.FullName || '';
    const customerPhone = customerPhoneInput || userProfile?.Phone || '';
    const customerAddress = customerAddressInput || userProfile?.Address || '';
    const customerEmail = normalizeEmail(body.customerEmail) || userProfile?.Email || '';
    const paymentMethod = typeof body.paymentMethod === 'string' ? body.paymentMethod.trim() : '';
    const notes = typeof body.notes === 'string' ? body.notes.trim() : '';
    const rawItems = Array.isArray(body.items) ? body.items : [];

    if (!customerName || !customerPhone || !customerAddress) {
        return { error: 'Vui lÃ²ng nháº­p Ä‘á»§ thÃ´ng tin ngÆ°á»i nháº­n.' };
    }

    if (!['cod', 'bank'].includes(paymentMethod)) {
        return { error: 'PhÆ°Æ¡ng thá»©c thanh toÃ¡n khÃ´ng há»£p lá»‡.' };
    }

    if (!rawItems.length) {
        return { error: 'Giá» hÃ ng Ä‘ang trá»‘ng.' };
    }

    const items = [];
    let totalAmount = 0;

    for (const rawItem of rawItems) {
        const productId = parseProductId(rawItem.productId);
        const quantity = Number.parseInt(rawItem.quantity, 10);

        if (!productId || !Number.isInteger(quantity) || quantity <= 0) {
            return { error: 'Dá»¯ liá»‡u sáº£n pháº©m trong giá» hÃ ng khÃ´ng há»£p lá»‡.' };
        }

        const product = productsById.get(productId);
        if (!product) {
            return { error: 'CÃ³ sáº£n pháº©m khÃ´ng cÃ²n tá»“n táº¡i.' };
        }

        const unitPrice = Number.isFinite(product.Price) ? product.Price : 0;
        const itemTotal = unitPrice * quantity;
        totalAmount += itemTotal;

        items.push({
            imageUrl: product.ImageUrl,
            name: product.Name,
            productId,
            quantity,
            sku: product.Sku || '',
            total: itemTotal,
            unitPrice
        });
    }

    return {
        customerAddress,
        customerEmail,
        customerName,
        customerPhone,
        items,
        notes,
        paymentMethod,
        totalAmount
    };
}

app.get('/', (req, res) => {
    sendFrontendPage(res, 'storefront', 'index.html');
});

app.get('/index.html', (req, res) => {
    sendFrontendPage(res, 'storefront', 'index.html');
});

app.get('/latest', (req, res) => {
    sendFrontendPage(res, 'storefront', 'latest.html');
});

app.get('/favorites', (req, res) => {
    sendFrontendPage(res, 'storefront', 'favorites.html');
});

app.get('/prices', (req, res) => {
    sendFrontendPage(res, 'storefront', 'prices.html');
});

app.get('/auth', (req, res) => {
    sendFrontendPage(res, 'storefront', 'auth.html');
});

app.get('/login', (req, res) => {
    sendFrontendPage(res, 'storefront', 'auth.html');
});

app.get('/register', (req, res) => {
    sendFrontendPage(res, 'storefront', 'auth.html');
});

app.get('/account', (req, res) => {
    sendFrontendPage(res, 'storefront', 'account.html');
});

app.get('/admin', (req, res) => {
    sendFrontendPage(res, 'admin', 'products.html');
});

app.get('/admin.html', (req, res) => {
    sendFrontendPage(res, 'admin', 'products.html');
});

app.get('/admin/login', (req, res) => {
    sendFrontendPage(res, 'admin', 'login.html');
});

app.get('/admin/orders', (req, res) => {
    sendFrontendPage(res, 'admin', 'orders.html');
});

app.get('/admin/users', (req, res) => {
    sendFrontendPage(res, 'admin', 'users.html');
});

app.post('/admin/login', (req, res) => {
    const username = typeof req.body.username === 'string' ? req.body.username.trim() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    if (!hasValidAdminCredentials(username, password)) {
        return res.redirect('/admin/login');
    }

    setAdminCookie(res);
    return res.redirect('/admin');
});

app.post('/api/admin/login', (req, res) => {
    const username = typeof req.body.username === 'string' ? req.body.username.trim() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    if (!hasValidAdminCredentials(username, password)) {
        return res.status(401).json({ message: 'Sai tÃ i khoáº£n hoáº·c máº­t kháº©u admin.' });
    }

    setAdminCookie(res);
    return res.json({ message: 'ÄÄƒng nháº­p thÃ nh cÃ´ng.' });
});

app.get('/api/admin/session', (req, res) => {
    return res.json({ authenticated: isAdminAuthenticated(req) });
});

app.post('/api/admin/logout', (req, res) => {
    clearAdminCookie(res);
    return res.json({ message: 'ÄÄƒng xuáº¥t thÃ nh cÃ´ng.' });
});

userAuth.registerRoutes(app, {
    filterOrdersForUser,
    readOrders
});

app.get('/api/admin/users', requireAdminApi, async (req, res) => {
    try {
        const [users, orders] = await Promise.all([
            userAuth.getAllUsers(),
            readOrders()
        ]);

        return res.json(users.map((user) => buildUserAdminView(user, orders)));
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

app.delete('/api/admin/users/:id', requireAdminApi, async (req, res) => {
    try {
        const id = parseProductId(req.params.id);
        if (!id) {
            return res.status(400).json({ message: 'ID tÃ i khoáº£n khÃ´ng há»£p lá»‡.' });
        }

        const user = await getUserById(id);
        if (!user) {
            return res.status(404).json({ message: 'KhÃ´ng tÃ¬m tháº¥y tÃ i khoáº£n.' });
        }

        const result = await db.request((pool) => pool.request()
            .input('id', mssql.BigInt, id)
            .query('DELETE FROM [Users] WHERE Id = @id'));

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ message: 'KhÃ´ng tÃ¬m tháº¥y tÃ i khoáº£n.' });
        }

        const orders = await readOrders();
        const normalizedOrders = orders.map((order) => (
            Number(order?.userId || 0) === id
                ? { ...order, userId: null }
                : order
        ));
        await writeOrders(normalizedOrders);

        return res.json({ message: 'ÄÃ£ xÃ³a tÃ i khoáº£n.' });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

app.post('/api/admin/users/:id/reset-password', requireAdminApi, async (req, res) => {
    try {
        const id = parseProductId(req.params.id);
        const newPassword = typeof req.body.newPassword === 'string' ? req.body.newPassword.trim() : '';

        if (!id) {
            return res.status(400).json({ message: 'ID tài khoản không hợp lệ.' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ message: 'Mật khẩu mới phải có ít nhất 6 ký tự.' });
        }

        const user = await getUserById(id);
        if (!user) {
            return res.status(404).json({ message: 'Không tìm thấy tài khoản.' });
        }

        const passwordSalt = createPasswordSalt();
        const passwordHash = hashPassword(newPassword, passwordSalt);
        const result = await db.request((pool) => pool.request()
            .input('id', mssql.BigInt, id)
            .input('passwordHash', mssql.NVarChar(256), passwordHash)
            .input('passwordSalt', mssql.NVarChar(128), passwordSalt)
            .query(`
                UPDATE [Users]
                SET password_hash = @passwordHash,
                    password_salt = @passwordSalt,
                    updated_at = GETDATE()
                WHERE Id = @id
            `));

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ message: 'Không tìm thấy tài khoản.' });
        }

        return res.json({ message: 'Mật khẩu cũ đã được thay bằng mật khẩu mới.' });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

app.get('/api/products', async (req, res) => {
    try {
        const products = await getMergedProducts();
        return res.json(products);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

app.post('/api/products', requireAdminApi, async (req, res) => {
    try {
        const payload = validateProductPayload(req.body);
        if (payload.error) {
            return res.status(400).json({ message: payload.error });
        }

        const finalImageUrl = payload.uploadedImage
            ? await persistUploadedImage(payload.uploadedImage)
            : payload.imageUrl;

        const insertResult = await db.request((pool) => pool.request()
            .input('name', mssql.NVarChar, payload.name)
            .input('img', mssql.NVarChar, finalImageUrl)
            .input('category', mssql.NVarChar, payload.category)
            .query('INSERT INTO Products (Name, ImageUrl, Category) OUTPUT INSERTED.Id VALUES (@name, @img, @category)'));

        const insertedId = insertResult.recordset[0]?.Id;
        const metadataMap = await readProductMetadataMap();
        metadataMap[String(insertedId)] = payload.metadata;
        await writeProductMetadataMap(metadataMap);

        return res.status(201).json({ message: 'ThÃªm thÃ nh cÃ´ng!', id: insertedId, imageUrl: finalImageUrl });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

app.put('/api/products/:id', requireAdminApi, async (req, res) => {
    try {
        const id = parseProductId(req.params.id);
        if (!id) {
            return res.status(400).json({ message: 'ID sáº£n pháº©m khÃ´ng há»£p lá»‡.' });
        }

        const existingProduct = await getProductById(id);
        if (!existingProduct) {
            return res.status(404).json({ message: 'KhÃ´ng tÃ¬m tháº¥y sáº£n pháº©m.' });
        }

        const payload = validateProductPayload(req.body);
        if (payload.error) {
            return res.status(400).json({ message: payload.error });
        }

        const finalImageUrl = payload.uploadedImage
            ? await persistUploadedImage(payload.uploadedImage)
            : payload.imageUrl;

        const result = await db.request((pool) => pool.request()
            .input('id', mssql.Int, id)
            .input('name', mssql.NVarChar, payload.name)
            .input('img', mssql.NVarChar, finalImageUrl)
            .input('category', mssql.NVarChar, payload.category)
            .query('UPDATE Products SET Name = @name, ImageUrl = @img, Category = @category WHERE Id = @id'));

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ message: 'KhÃ´ng tÃ¬m tháº¥y sáº£n pháº©m.' });
        }

        const metadataMap = await readProductMetadataMap();
        metadataMap[String(id)] = payload.metadata;
        await writeProductMetadataMap(metadataMap);

        if (existingProduct.ImageUrl !== finalImageUrl) {
            await deleteManagedProductImage(existingProduct.ImageUrl);
        }

        return res.json({ message: 'Cáº­p nháº­t thÃ nh cÃ´ng!', imageUrl: finalImageUrl });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

app.delete('/api/products/:id', requireAdminApi, async (req, res) => {
    try {
        const id = parseProductId(req.params.id);
        if (!id) {
            return res.status(400).json({ message: 'ID sáº£n pháº©m khÃ´ng há»£p lá»‡.' });
        }

        const existingProduct = await getProductById(id);
        if (!existingProduct) {
            return res.status(404).json({ message: 'KhÃ´ng tÃ¬m tháº¥y sáº£n pháº©m.' });
        }

        const result = await db.request((pool) => pool.request()
            .input('id', mssql.Int, id)
            .query('DELETE FROM Products WHERE Id = @id'));

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ message: 'KhÃ´ng tÃ¬m tháº¥y sáº£n pháº©m.' });
        }

        const metadataMap = await readProductMetadataMap();
        delete metadataMap[String(id)];
        await writeProductMetadataMap(metadataMap);
        await deleteManagedProductImage(existingProduct.ImageUrl);

        return res.json({ message: 'XÃ³a thÃ nh cÃ´ng!' });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

app.post('/api/orders', userAuth.requireUserApi, async (req, res) => {
    try {
        const products = await getMergedProducts();
        const productsById = new Map(products.map((product) => [product.Id, product]));
        const user = req.authenticatedUser;
        const payload = validateCheckoutPayload(req.body, productsById, user);

        if (payload.error) {
            return res.status(400).json({ message: payload.error });
        }

        const order = {
            createdAt: new Date().toISOString(),
            currency: DEFAULT_CURRENCY,
            customerAddress: payload.customerAddress,
            customerEmail: payload.customerEmail,
            customerName: payload.customerName,
            customerPhone: payload.customerPhone,
            items: payload.items,
            notes: payload.notes,
            orderNumber: buildOrderNumber(),
            paymentMethod: payload.paymentMethod,
            status: 'pending',
            totalAmount: payload.totalAmount,
            userId: user?.Id || null
        };

        await appendOrder(order);

        return res.status(201).json({
            message: 'Äáº·t hÃ ng thÃ nh cÃ´ng.',
            orderNumber: order.orderNumber,
            totalAmount: order.totalAmount
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

app.get('/api/orders', requireAdminApi, async (req, res) => {
    try {
        const orders = await readOrders();
        return res.json(sortOrdersByCreatedAtDesc(orders));
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

app.use(express.static(FRONTEND_DIR, {
    setHeaders(res) {
        res.set('Cache-Control', 'no-store');
    }
}));

app.use((err, req, res, next) => {
    if (res.headersSent) {
        return next(err);
    }

    if (err && (err.type === 'entity.parse.failed' || err instanceof SyntaxError)) {
        return res.status(400).json({ message: 'Dá»¯ liá»‡u JSON khÃ´ng há»£p lá»‡.' });
    }

    console.error('[ERROR]', err);
    return res.status(err?.status || 500).json({ message: 'Lá»—i mÃ¡y chá»§.' });
});

app.listen(PORT, () => {
    console.log(`[START] Backend running on http://localhost:${PORT}`);
    console.log(`[START] Storefront: http://localhost:${PORT}/`);
    console.log(`[START] Admin: http://localhost:${PORT}/admin`);
    console.log(`[START] Admin login (inline): http://localhost:${PORT}/admin`);
    console.log(`[START] API: http://localhost:${PORT}/api/products`);
    console.log(`[START] Orders API: http://localhost:${PORT}/api/orders`);
    console.log(`[START] Admin user: ${ADMIN_USERNAME}`);
    console.log(`[START] Admin password: ${ADMIN_PASSWORD}`);
});
