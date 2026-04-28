const crypto = require('crypto');

const USER_COOKIE_NAME = 'xuanphu_user';
const PASSWORD_HASH_ITERATIONS = 120000;
const PASSWORD_HASH_KEY_LENGTH = 64;
const PASSWORD_HASH_DIGEST = 'sha512';

function createUserAuth(options) {
    const mssql = options.mssql;
    const db = options.db;

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

    function parseCookies(req) {
        const header = req.headers.cookie || '';
        return header.split(';').reduce((acc, entry) => {
            const parts = entry.trim().split('=');
            const rawKey = parts.shift();
            if (!rawKey) return acc;
            acc[rawKey] = decodeURIComponent(parts.join('='));
            return acc;
        }, {});
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
            return { error: 'Họ tên phải có ít nhất 2 ký tự.' };
        }

        if (!isValidEmail(email)) {
            return { error: 'Email không hợp lệ.' };
        }

        if (!isValidPhone(phone)) {
            return { error: 'Số điện thoại không hợp lệ.' };
        }

        if (!address) {
            return { error: 'Địa chỉ nhận hàng là bắt buộc.' };
        }

        if (password.length < 6) {
            return { error: 'Mật khẩu phải có ít nhất 6 ký tự.' };
        }

        if (confirmPassword && password !== confirmPassword) {
            return { error: 'Mật khẩu xác nhận không khớp.' };
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
            return { error: 'Email không hợp lệ.' };
        }

        if (!password) {
            return { error: 'Mật khẩu là bắt buộc.' };
        }

        return { email, password };
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
        const cookieParts = rawCookie.split('.');
        const rawId = cookieParts[0];
        const token = cookieParts[1];
        const id = Number.parseInt(rawId, 10);

        if (!Number.isInteger(id) || id <= 0 || !token) {
            return null;
        }

        const user = await getUserById(id);
        if (!isUserActive(user)) {
            return null;
        }

        return createUserSessionToken(user) === token ? user : null;
    }

    async function requireUserApi(req, res, next) {
        try {
            const user = await getAuthenticatedUser(req);
            if (!user) {
                return res.status(401).json({ message: 'Vui lòng đăng nhập để tiếp tục.' });
            }

            req.authenticatedUser = user;
            return next();
        } catch (error) {
            return res.status(500).json({ message: error.message });
        }
    }

    function registerRoutes(app, helpers) {
        app.get('/api/users/me', requireUserApi, (req, res) => {
            return res.json({ user: toPublicUser(req.authenticatedUser) });
        });

        app.get('/api/users/orders', requireUserApi, async (req, res) => {
            try {
                const orders = await helpers.readOrders();
                return res.json({ orders: helpers.filterOrdersForUser(orders, req.authenticatedUser) });
            } catch (error) {
                return res.status(500).json({ message: error.message });
            }
        });

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
                const existingEmailUser = results[0];
                const existingPhoneUser = results[1];

                if (existingEmailUser) {
                    return res.status(409).json({ message: 'Email này đã được sử dụng.' });
                }

                if (existingPhoneUser) {
                    return res.status(409).json({ message: 'Số điện thoại này đã được sử dụng.' });
                }

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
                const createdUser = await getUserById(createdUserId);

                setUserCookie(res, createdUser);
                return res.status(201).json({
                    message: 'Tạo tài khoản thành công.',
                    user: toPublicUser(createdUser)
                });
            } catch (error) {
                return res.status(500).json({ message: error.message });
            }
        });

        app.post('/api/users/login', async (req, res) => {
            try {
                const payload = validateUserLoginPayload(req.body);
                if (payload.error) {
                    return res.status(400).json({ message: payload.error });
                }

                const user = await getUserByEmail(payload.email);
                if (!isUserActive(user)) {
                    return res.status(401).json({ message: 'Email hoặc mật khẩu không đúng.' });
                }

                const passwordHash = hashPassword(payload.password, user.PasswordSalt);
                if (passwordHash !== user.PasswordHash) {
                    return res.status(401).json({ message: 'Email hoặc mật khẩu không đúng.' });
                }

                setUserCookie(res, user);
                return res.json({
                    message: 'Đăng nhập thành công.',
                    user: toPublicUser(user)
                });
            } catch (error) {
                return res.status(500).json({ message: error.message });
            }
        });

        app.post('/api/users/logout', (req, res) => {
            clearUserCookie(res);
            return res.json({ message: 'Đăng xuất thành công.' });
        });
    }

    return {
        getAllUsers,
        getAuthenticatedUser,
        normalizeEmail,
        registerRoutes,
        requireUserApi
    };
}

module.exports = {
    createUserAuth
};
