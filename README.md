# Xuan Phu Gold

## 1. Tong quan

Day la mot ung dung web full-stack chay theo kieu "server render route + static frontend pages".

- Frontend la bo HTML/CSS/JS tinh trong `fe/`
- Backend la Node.js + Express trong `be/`
- Database chinh la SQL Server
- Mot phan du lieu van dang luu bang JSON tren disk

Ung dung duoc tach thanh 2 khu:

- Storefront cho khach hang
- Admin cho quan tri vien

Khac voi mot SPA React/Vue, project nay chon cach tach tung man hinh thanh HTML rieng. Cach nay don gian hon cho local project, de debug bang trinh duyet, khong can build step, va phu hop voi codebase dang van hanh hien tai.

## 2. Kien truc tong the

```text
Browser
  -> HTML page trong fe/storefront hoac fe/admin
  -> JS page controller trong fe/js
  -> API client goi ve Express server
  -> Express route / API trong be/server-main.js + be/auth/user-auth.js
  -> SQL Server cho Products / Users / UserProfiles
  -> JSON files cho orders.json va product-metadata.json
```

Data flow chinh:

1. Trinh duyet mo route nhu `/`, `/latest`, `/account`, `/admin`, `/admin/users`
2. Express tra ve file HTML tu `fe/storefront` hoac `fe/admin`
3. HTML load CSS va JS tu `/css/...` va `/js/...`
4. JS goi API `/api/...`
5. Backend doc/ghi SQL Server, doc/ghi JSON, merge du lieu roi tra JSON ve frontend

## 3. Cau truc thu muc

```text
.
|-- README.md
|-- start-backend.cmd
|-- stop-backend.cmd
|-- database/
|   `-- SQLQuery1.sql
|-- be/
|   |-- package.json
|   |-- package-lock.json
|   |-- server-main.js
|   |-- db-pool.js
|   |-- auth/
|   |   `-- user-auth.js
|   |-- data/
|   |   |-- orders.json
|   |   `-- product-metadata.json
|   `-- node_modules/
`-- fe/
    |-- admin/
    |   |-- login.html
    |   |-- products.html
    |   |-- orders.html
    |   `-- users.html
    |-- storefront/
    |   |-- index.html
    |   |-- latest.html
    |   |-- favorites.html
    |   |-- prices.html
    |   |-- auth.html
    |   `-- account.html
    |-- css/
    |   |-- style.css
    |   |-- storefront.css
    |   `-- admin.css
    |-- js/
    |   |-- api-client.js
    |   |-- storefront-pages.js
    |   |-- banner.js
    |   |-- gold-price.js
    |   |-- admin-pages.js
    |   |-- admin-products-section.js
    |   |-- admin-orders-section.js
    |   `-- admin-users-section.js
    |-- img/
    |   |-- icon.ico
    |   |-- image.png
    |   |-- banner_2.jpg
    |   `-- banner_3.png
    `-- uploads/
        `-- products/
```

## 4. Cong dung tung khu vuc

### 4.1. Backend

#### `be/server-main.js`

Day la file entrypoint quan trong nhat cua he thong. No chiu trach nhiem:

- tao Express app
- cau hinh CORS, JSON body, urlencoded body
- phuc vu page frontend
- phuc vu static assets
- xac thuc admin bang cookie
- CRUD san pham
- tao va doc don hang
- tong hop du lieu user cho admin
- khoi tao user auth module

File nay la "composition root" cua du an. Neu can tim luong xu ly thuc te, day la file can doc dau tien.

#### `be/auth/user-auth.js`

Module auth cho khach hang:

- dang ky
- dang nhap
- dang xuat
- lay user hien tai
- lay don hang cua user hien tai
- middleware `requireUserApi`

No duoc tach rieng de `server-main.js` khong bi qua tai boi logic auth user.

#### `be/db-pool.js`

Wrapper quan ly ket noi SQL Server:

- tao pool
- reconnect khi connection loi
- helper `request()`
- helper `transaction()`

File nay can thiet vi project dang goi SQL Server nhieu lan va can mot noi gom logic reconnect cho gon.

#### `be/data/product-metadata.json`

Luu metadata san pham khong nam trong bang `Products`, gom:

- `price`
- `description`
- `material`
- `sku`
- `weight`
- `currency`

Ly do hien tai phai dung:

- Bang `Products` trong SQL moi luu field co ban
- Chua co migration SQL cho toan bo metadata mo rong
- JSON giup them field nhanh trong giai doan prototype

#### `be/data/orders.json`

Luu don hang dat tu storefront. Moi order co:

- `orderNumber`
- `createdAt`
- `customerName`
- `customerPhone`
- `customerAddress`
- `customerEmail`
- `paymentMethod`
- `status`
- `items`
- `totalAmount`
- `userId`

Ly do hien tai phai dung:

- Project co order flow chay duoc ngay ma chua can tao bang order trong SQL
- de doc/sua nhanh khi debug local

Han che:

- khong phu hop cho nhieu user dong thoi
- kho truy van phuc tap
- khong co rang buoc quan he nhu SQL

### 4.2. Frontend

#### `fe/storefront/`

La bo giao dien khach hang. Moi page la mot HTML rieng:

- `index.html`: trang pho bien
- `latest.html`: trang san pham moi nhat
- `favorites.html`: trang yeu thich
- `prices.html`: trang gia vang hom nay
- `auth.html`: giao dien login + register cho user
- `account.html`: thong tin tai khoan va lich su don hang

#### `fe/admin/`

La bo giao dien admin:

- `login.html`: login admin
- `products.html`: quan ly san pham
- `orders.html`: xem don hang
- `users.html`: quan ly user, reset password, xem order history

#### `fe/js/api-client.js`

La lop ket noi chung giua frontend va backend:

- xac dinh API base
- ho tro same-origin mode
- ho tro file mode qua query/localStorage/meta
- helper build URL API
- helper resolve asset URL
- helper tao request init cho admin

File nay duoc dung boi ca storefront va admin.

Tai sao phai co:

- tranh hardcode host trong tung file JS
- cho phep chay linh hoat khi mo HTML truc tiep hoac khi di qua Express

#### `fe/js/storefront-pages.js`

Day la bo nao chinh cua storefront. File nay lam rat nhieu viec:

- fetch danh sach san pham
- render gallery cho popular/latest/favorites
- search san pham
- mo overlay chi tiet san pham
- quan ly gio hang bang localStorage
- dang ky, dang nhap, dang xuat user
- goi API dat hang
- hien thi account va lich su don hang
- quan ly favorites theo scope tung account tren cung may

Tai sao can 1 file controller chung:

- cac page storefront tuy tach HTML nhung dung chung component logic
- gom logic vao 1 noi tranh lap lai qua nhieu file JS

#### `fe/js/banner.js`

Dieu khien slide banner o trang chu.

#### `fe/js/gold-price.js`

Chi dung cho page gia vang:

- fetch `https://www.vang.today/api/prices`
- quy doi thanh cac dong gia hien thi
- luu gia lan truoc vao localStorage
- hien thi thay doi tang/giam
- auto refresh moi 5 phut

#### `fe/js/admin-pages.js`

Controller chung cho admin:

- auth gate
- check session admin
- redirect giua login va dashboard
- switch section
- helper fetch/admin API
- helper feedback, modal, format, resolve asset

#### `fe/js/admin-products-section.js`

Logic rieng cua tab products:

- fetch san pham
- render bang san pham
- mo modal them/sua
- upload anh
- luu / xoa san pham

#### `fe/js/admin-orders-section.js`

Logic rieng cua tab orders:

- fetch don hang
- render bang don hang

#### `fe/js/admin-users-section.js`

Logic rieng cua tab users:

- fetch danh sach user
- render bang user
- mo/thu gon lich su mua hang
- reset password
- xoa user

### 4.3. CSS

#### `fe/css/style.css`

File CSS nen lon nhat. Day la kho rule base + mot so rule cu van con anh huong runtime.

Khong nen xoa bo file nay luc nay vi:

- `storefront.css` va `admin.css` deu `@import` file nay
- nhieu class runtime van dang an style tu day
- project da co dau hieu rule cu chen nhau, nen cleanup can lam theo tung dot nho

#### `fe/css/storefront.css`

Override va them style cho khu storefront.

#### `fe/css/admin.css`

Override va them style cho khu admin.

### 4.4. Code minh hoa truc tiep tu project

Toan bo cac doan duoi day la trich thang tu source hien tai cua project, khong phai pseudocode.

#### A. Express route phuc vu page va gan auth user

Nguon: `be/server-main.js`

```js
app.get('/', (req, res) => {
    sendFrontendPage(res, 'storefront', 'index.html');
});

app.get('/latest', (req, res) => {
    sendFrontendPage(res, 'storefront', 'latest.html');
});

app.get('/account', (req, res) => {
    sendFrontendPage(res, 'storefront', 'account.html');
});

app.get('/admin', (req, res) => {
    sendFrontendPage(res, 'admin', 'products.html');
});

app.get('/admin/users', (req, res) => {
    sendFrontendPage(res, 'admin', 'users.html');
});

userAuth.registerRoutes(app, {
    filterOrdersForUser,
    readOrders
});
```

Doan nay cho thay backend dang dung Express de route truc tiep sang file HTML, dong thoi "cam" module auth user vao app qua `registerRoutes`.

#### B. Auth user: dang ky, luu Users va UserProfiles trong cung transaction

Nguon: `be/auth/user-auth.js`

```js
app.post('/api/users/register', async (req, res) => {
    try {
        const payload = validateUserRegisterPayload(req.body);
        if (payload.error) {
            return res.status(400).json({ message: payload.error });
        }

        const results = await Promise.all([
            getUserByEmail(payload.email),
            getUserByPhone(payload.phone)
        ]);

        const passwordSalt = createPasswordSalt();
        const passwordHash = hashPassword(payload.password, passwordSalt);
        const username = payload.email;
        const createdUserId = await db.transaction(async (transaction) => {
            const insertUserResult = await new mssql.Request(transaction)
                .input('username', mssql.NVarChar(50), username)
                .input('email', mssql.NVarChar(254), payload.email)
                .input('passwordSalt', mssql.NVarChar(128), passwordSalt)
                .input('passwordHash', mssql.NVarChar(256), passwordHash)
                .query(`
                    INSERT INTO [Users] (username, email, password_hash, password_salt)
                    OUTPUT INSERTED.id AS Id
                    VALUES (@username, @email, @passwordHash, @passwordSalt)
                `);

            const insertedId = insertUserResult.recordset[0] && insertUserResult.recordset[0].Id;

            await new mssql.Request(transaction)
                .input('id', mssql.BigInt, insertedId)
                .input('fullName', mssql.NVarChar(200), payload.fullName)
                .input('phone', mssql.NVarChar(50), payload.phone)
                .input('address', mssql.NVarChar(500), payload.address)
                .query(`
                    INSERT INTO [UserProfiles] (id, full_name, phone_number, address)
                    VALUES (@id, @fullName, @phone, @address)
                `);
            return insertedId;
        });
```

Day la ly do README mo ta `Users` va `UserProfiles` la hai bang tach nhau nhung duoc tao trong cung mot transaction.

#### C. SQL pool manager co retry va transaction helper

Nguon: `be/db-pool.js`

```js
async function request(handler) {
    try {
        const pool = await connect();
        return await handler(pool);
    } catch (error) {
        if (!isConnectionError(error)) {
            throw error;
        }

        const pool = await connect(true);
        return handler(pool);
    }
}

async function transaction(handler) {
    return request(async (pool) => {
        const transaction = new mssql.Transaction(pool);
        await transaction.begin();

        try {
            const result = await handler(transaction);
            await transaction.commit();
            return result;
        } catch (error) {
            try {
                await transaction.rollback();
            } catch {
                // Ignore rollback failures while bubbling up the original error.
            }
            throw error;
        }
    });
}
```

Doan nay giai thich tai sao project co file `db-pool.js` rieng thay vi query SQL truc tiep o moi noi.

#### D. API client dung chung cho frontend/admin

Nguon: `fe/js/api-client.js`

```js
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
```

Doan nay cho thay `api-client.js` khong chi la helper URL ma con dung de bridge giua che do same-origin va file mode.

#### E. San pham hien tai la model hybrid SQL + JSON

Nguon: `be/server-main.js`

```js
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
```

README phan data flow noi "hybrid" la dua tren doan code nay.

#### F. Checkout user -> validate -> tao order JSON

Nguon: `be/server-main.js`

```js
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
            message: 'Đặt hàng thành công.',
            orderNumber: order.orderNumber,
            totalAmount: order.totalAmount
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});
```

Doan nay la business flow that cua storefront checkout.

#### G. Favorites da duoc tach theo tung account

Nguon: `fe/js/storefront-pages.js`

```js
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
```

Day la phan code that cho fix "yeu thich cua moi tai khoan phai khac nhau".

#### H. Storefront doi scope favorites khi user thay doi

Nguon: `fe/js/storefront-pages.js`

```js
function renderCurrentUser(user) {
  var previousFavoriteScope = getFavoriteScope(currentUser);
  currentUser = user || null;
  if (getFavoriteScope(currentUser) !== previousFavoriteScope) {
    refreshFavoritesState();
  }

  document.body.classList.toggle('user-guest', !currentUser);
```

Doan nay cho thay UI storefront khong chi doi text account, ma con doi luon bucket favorites theo session user hien tai.

#### I. Admin products fetch va render bang

Nguon: `fe/js/admin-products-section.js`

```js
async function fetchAdminProducts() {
    const productList = document.getElementById('product-list');
    if (!productList) return;

    productList.innerHTML = '<p class="gallery-message">Đang tải dữ liệu...</p>';

    try {
        const response = await fetch(buildAdminApiUrl(ADMIN_API_URL), buildAdminRequestInit());
        const products = await handleAdminJsonResponse(response);

        if (!Array.isArray(products) || products.length === 0) {
            productList.innerHTML = '<p class="gallery-message is-empty">Chưa có sản phẩm nào. Hãy thêm sản phẩm đầu tiên.</p>';
            writeAdminFeedback('');
            return;
        }

        productList.innerHTML = '';
        productList.appendChild(createAdminProductTable(products));
        writeAdminFeedback('');
    } catch (error) {
        console.error(error);
        productList.innerHTML = '<p class="gallery-message is-error">Không thể tải danh sách sản phẩm từ backend.</p>';
        writeAdminFeedback(error.message || 'Không thể tải dữ liệu sản phẩm.', 'error');
    }
}
```

Doan nay cho thay admin products page hien tai render bang bang JavaScript thuong, khong co framework.

#### J. Admin orders render bang tu `orders.json`

Nguon: `fe/js/admin-orders-section.js`

```js
async function fetchAdminOrders() {
    const orderList = document.getElementById('order-list');
    const ordersFeedback = document.getElementById('orders-feedback');
    if (!orderList) return;

    orderList.innerHTML = '<p class="gallery-message">Đang tải đơn hàng...</p>';

    try {
        const response = await fetch(buildAdminApiUrl(ADMIN_ORDERS_API_URL), buildAdminRequestInit());
        const orders = await handleAdminJsonResponse(response);

        if (!Array.isArray(orders) || orders.length === 0) {
            orderList.innerHTML = '<p class="gallery-message is-empty">Chưa có đơn hàng nào.</p>';
            return;
        }

        orderList.innerHTML = '';
        orderList.appendChild(createAdminOrdersTable(orders));
    } catch (error) {
        console.error(error);
        orderList.innerHTML = '<p class="gallery-message is-error">Không thể tải danh sách đơn hàng.</p>';
    }
}
```

Doan nay noi ro orders page dang doc API `/api/orders` roi render bang tren client.

#### K. Admin users co detail row va toggle lich su

Nguon: `fe/js/admin-users-section.js`

```js
const detailRow = document.createElement('tr');
detailRow.className = 'admin-user-detail-row d-none';
detailRow.hidden = true;

detailRow.innerHTML = `
    <td colspan="8">
        <div class="admin-user-detail">
            <div class="admin-user-detail-grid">
                <article class="admin-user-detail-card">
                    <span>Địa chỉ</span>
                    <strong>${escapeAdminHtml(user.address || 'Chưa cập nhật')}</strong>
                </article>
                <article class="admin-user-detail-card">
                    <span>Đơn gần nhất</span>
                    <strong>${escapeAdminHtml(formatAdminDateTime(user.lastOrderAt))}</strong>
                </article>
            </div>
            <div class="admin-user-orders">
                ${renderAdminUserOrders(user.orders)}
            </div>
        </div>
    </td>
`;

const toggleOrdersBtn = row.querySelector('[data-user-action="toggle-orders"]');
if (toggleOrdersBtn) {
    const syncToggleOrdersLabel = () => {
        const isHidden = detailRow.hidden || detailRow.classList.contains('d-none');
        toggleOrdersBtn.textContent = isHidden ? 'Lịch sử' : 'Ẩn lịch sử';
        toggleOrdersBtn.setAttribute('aria-expanded', String(!isHidden));
    };
```

Day la phan code that cua UI mo/thu gon lich su don hang trong admin users.

#### L. Gold price page goi API ngoai va luu gia cu vao localStorage

Nguon: `fe/js/gold-price.js`

```js
let lastPrices = JSON.parse(localStorage.getItem('goldPrices')) || {
  vang24k: 0,
  vang18k: 0,
  vang14k: 0,
  bac999: 0
};

function fetchGoldPrices() {
  const status = document.querySelector('.price-status');

  if (status) {
    status.textContent = 'Đang cập nhật giá...';
    status.style.color = '#777';
  }

  fetch('https://www.vang.today/api/prices')
    .then(res => res.json())
    .then(res => {
      if (!res.success || !res.prices) {
        throw new Error('API lỗi');
      }
```

Doan nay la can cu cho muc "gia vang hom nay" trong README.

#### M. Banner trang chu chay bang JS rat gon

Nguon: `fe/js/banner.js`

```js
document.addEventListener('DOMContentLoaded', function() {
  var slideImg = document.querySelectorAll('.slide_img');
  if (!slideImg.length) return;

  var i = 0;
  slideImg.forEach(function(img, idx) {
    if (idx !== 0) img.classList.remove('active_second');
  });

  setInterval(function() {
    slideImg[i].classList.remove('active_second');
    i++;
    if (i >= slideImg.length) {
      i = 0;
    }
    slideImg[i].classList.add('active_second');
  }, 10000);
});
```

#### N. Script chay backend tren Windows

Nguon: `start-backend.cmd`

```bat
@echo off
setlocal

set "ROOT_DIR=%~dp0"
set "BE_DIR=%ROOT_DIR%be"

echo [INFO] Stopping any process using port 3000...
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do (
  taskkill /PID %%P /F >nul 2>&1
)

cd /d "%BE_DIR%"
start "Xuan Phu Backend" cmd /k node server-main.js
```

Doan nay cho thay project hien tai uu tien cach chay local bang script Windows, khong can them PM2 hoac tool process manager khac.

## 5. Route map thuc te

### 5.1. Frontend routes do Express phuc vu

| Route | HTML duoc tra ve | Muc dich |
|---|---|---|
| `/` | `fe/storefront/index.html` | Trang chu popular |
| `/index.html` | `fe/storefront/index.html` | Alias cho trang chu |
| `/latest` | `fe/storefront/latest.html` | San pham moi nhat |
| `/favorites` | `fe/storefront/favorites.html` | San pham yeu thich |
| `/prices` | `fe/storefront/prices.html` | Gia vang hom nay |
| `/auth` | `fe/storefront/auth.html` | Login/register |
| `/login` | `fe/storefront/auth.html` | Alias login |
| `/register` | `fe/storefront/auth.html` | Alias register |
| `/account` | `fe/storefront/account.html` | Tai khoan user |
| `/admin` | `fe/admin/products.html` | Dashboard products |
| `/admin.html` | `fe/admin/products.html` | Alias admin dashboard |
| `/admin/login` | `fe/admin/login.html` | Login admin |
| `/admin/orders` | `fe/admin/orders.html` | Don hang |
| `/admin/users` | `fe/admin/users.html` | Tai khoan user |

### 5.2. API routes

#### User APIs

| Method | Route | Cong dung |
|---|---|---|
| `GET` | `/api/users/me` | Lay user dang dang nhap |
| `GET` | `/api/users/orders` | Lay order cua user dang dang nhap |
| `POST` | `/api/users/register` | Dang ky user |
| `POST` | `/api/users/login` | Dang nhap user |
| `POST` | `/api/users/logout` | Dang xuat user |

#### Admin auth APIs

| Method | Route | Cong dung |
|---|---|---|
| `POST` | `/api/admin/login` | Dang nhap admin |
| `GET` | `/api/admin/session` | Kiem tra session admin |
| `POST` | `/api/admin/logout` | Dang xuat admin |

#### Admin user APIs

| Method | Route | Cong dung |
|---|---|---|
| `GET` | `/api/admin/users` | Lay danh sach user + tong hop order |
| `DELETE` | `/api/admin/users/:id` | Xoa user |
| `POST` | `/api/admin/users/:id/reset-password` | Reset password user |

#### Product APIs

| Method | Route | Cong dung |
|---|---|---|
| `GET` | `/api/products` | Lay san pham da merge SQL + metadata JSON |
| `POST` | `/api/products` | Tao san pham moi |
| `PUT` | `/api/products/:id` | Cap nhat san pham |
| `DELETE` | `/api/products/:id` | Xoa san pham |

#### Order APIs

| Method | Route | Cong dung |
|---|---|---|
| `POST` | `/api/orders` | User dat hang |
| `GET` | `/api/orders` | Admin xem tat ca don hang |

## 6. Cach ket noi du lieu

### 6.1. San pham

Nguon du lieu san pham hien tai la kieu "hybrid".

1. SQL `Products` luu:
   - `Id`
   - `Name`
   - `ImageUrl`
   - `Category`
2. JSON `product-metadata.json` luu:
   - `price`
   - `description`
   - `material`
   - `sku`
   - `weight`
   - `currency`
3. Backend goi `getMergedProducts()`
4. Backend merge 2 nguon thanh 1 object JSON cho frontend/admin

Tai sao phai merge:

- san pham van can ton tai co khoa chinh trong SQL
- metadata thay doi nhanh nen dang de o JSON
- frontend/admin van muon nhin thay 1 model san pham thong nhat

### 6.2. Tai khoan user

Tai khoan khach hang dung SQL Server:

- `Users`: auth, email, password hash, status
- `UserProfiles`: ho ten, so dien thoai, dia chi

Tai sao phai tach 2 bang:

- `Users` la identity/auth core
- `UserProfiles` la profile mo rong 1-1
- ve mat thiet ke du lieu, day la cach hop ly hon viec nhom tat ca vao 1 bang

### 6.3. Don hang

Don hang hien dang o `orders.json`.

Frontend checkout:

1. user dang nhap
2. them san pham vao cart localStorage
3. submit checkout form
4. frontend goi `POST /api/orders`
5. backend validate user, validate cart, tinh tong tien tu product data
6. backend append order vao `orders.json`

Admin/users page doc lai JSON nay de render bang va lich su mua hang.

### 6.4. Favorites

Favorites cua storefront hien dang luu o localStorage tren trinh duyet.
Ban fix moi nhat da tach favorites theo tung account tren cung mot may, khong con dung chung 1 bucket cho moi user.

Gioi han:

- chua dong bo cross-device
- doi may hoac xoa browser storage thi mat favorites

Neu can multi-device favorites, buoc tiep theo la dua favorites vao backend.

## 7. Moi lien ket giua page, JS va CSS

### Storefront

| Page | CSS | JS | Mo ta |
|---|---|---|---|
| `index.html` | `storefront.css` | `banner.js`, `api-client.js`, `storefront-pages.js` | popular page + banner |
| `latest.html` | `storefront.css` | `api-client.js`, `storefront-pages.js` | latest page |
| `favorites.html` | `storefront.css` | `api-client.js`, `storefront-pages.js` | favorite page |
| `prices.html` | `storefront.css` | `api-client.js`, `storefront-pages.js`, `gold-price.js` | bang gia vang |
| `auth.html` | `storefront.css` | `api-client.js`, `storefront-pages.js` | login/register |
| `account.html` | `storefront.css` | `api-client.js`, `storefront-pages.js` | profile + order history |

### Admin

| Page | CSS | JS | Mo ta |
|---|---|---|---|
| `login.html` | `admin.css` | `api-client.js`, `admin-pages.js` | admin auth gate |
| `products.html` | `admin.css` | `api-client.js`, `admin-pages.js`, `admin-products-section.js` | CRUD san pham |
| `orders.html` | `admin.css` | `api-client.js`, `admin-pages.js`, `admin-orders-section.js` | xem don hang |
| `users.html` | `admin.css` | `api-client.js`, `admin-pages.js`, `admin-users-section.js` | user management |

## 8. Setup va cach chay

### 8.1. Yeu cau

- Windows
- Node.js
- SQL Server Express hoac SQL Server co instance phu hop

### 8.2. Khoi tao database

1. Mo SQL Server
2. Chay file `database/SQLQuery1.sql`
3. Xac nhan da tao DB `XuanPhuGold`

### 8.3. Cau hinh hien tai trong code

Trong `be/server-main.js`, backend dang dung:

- port: `3000`
- SQL user: `sa`
- SQL password: `123456789`
- SQL server: `LAPTOP-5JFTF2UJ\\SQLEXPRESS`
- SQL database: `XuanPhuGold`
- admin username fallback: `admin`
- admin password fallback: `XuanPhu@2026`

Day la cau hinh local hien tai, chua duoc dua ra bien moi truong day du.

### 8.4. Cai dependencies

Neu la may moi:

```bash
cd be
npm install
```

Neu thu muc `be/node_modules` da ton tai va hop le thi co the bo qua buoc nay.

### 8.5. Chay backend

Cach 1:

```bash
start-backend.cmd
```

Cach 2:

```bash
cd be
node server-main.js
```

### 8.6. URL can mo

- `http://localhost:3000/`
- `http://localhost:3000/admin`

## 9. Tai sao kien truc nay dang duoc dung

### 9.1. Tai sao dung HTML rieng thay vi SPA framework

- khong can build tool
- de deploy local
- de debug DOM/CSS truc tiep
- phu hop codebase dang o giai doan procedural

### 9.2. Tai sao dung SQL cho user va product core

- can khoa chinh va rang buoc ro rang
- can truy van co cau truc
- de mo rong cho auth va quan tri

### 9.3. Tai sao van co JSON

- project dang trong giai doan chuyen tiep
- metadata va orders duoc them nhanh hon khi de ngoai SQL
- giam khoi luong migration luc dau

### 9.4. Tai sao co `api-client.js`

- tach phan xac dinh API base ra khoi tung page
- giam lap lai
- cho phep su dung cung mot frontend trong nhieu cach mo file/serve

## 10. Cleanup da lam trong lan ra soat nay

Da xoa 3 file JS legacy khong con duoc route, HTML hay runtime nao su dung:

- `fe/js/storefront-app.js`
- `fe/js/admin-shared.js`
- `fe/js/admin-gallery.js`

Ly do xoa:

- khong con script tag nao load
- khong con route nao tro toi
- de tranh nham lan giua "file dang song" va "file cu"

Da giu lai:

- `fe/css/style.css`
- `fe/css/storefront.css`
- `fe/css/admin.css`

Ly do giu:

- van dang anh huong runtime
- co override chen nhau
- xoa luc nay co nguy co lam vo layout dang chay

## 11. Diem manh va diem yeu hien tai

### Diem manh

- de chay local
- khong can build frontend
- tach page ro rang
- auth user da co hash password
- admin da co dashboard tach theo khu vuc

### Diem yeu

- secret va DB config dang hardcode
- order va product metadata chua dong bo vao SQL
- text tieng Viet trong code/schema dang co loi encoding
- CSS con nhieu rule cu chen nhau
- favorites moi tach theo account trong localStorage, chua len backend

## 12. Huong refactor de nghi

Neu muon nang cap he thong dung huong hon, thu tu hop ly la:

1. Dua toan bo config nhay cam ra environment variables
2. Dua `orders` vao SQL
3. Dua `product metadata` vao SQL hoac migration schema ro rang
4. Tach `style.css` thanh base tokens + storefront + admin clean overrides
5. Dua favorites vao backend neu can dong bo nhieu thiet bi
6. Chuan hoa lai encoding UTF-8 cho SQL, JS, JSON, HTML

## 13. Ghi chu quan trong cho lan sua sau

- Nguon su that runtime nam o route Express va script tag trong HTML, khong phai o ten file cu.
- Truoc khi xoa CSS, can kiem tra rule do co con bi import boi `storefront.css` hoac `admin.css` hay khong.
- Truoc khi xoa du lieu JSON, can kiem tra backend co dang doc file do trong `server-main.js` hoac `user-auth.js` hay khong.
- Neu muon tiep tuc cleanup layout, nen lam theo tung khoi nho: topbar, table, footer, sidebar. Khong nen xoa mass rule trong `style.css` mot lan.
