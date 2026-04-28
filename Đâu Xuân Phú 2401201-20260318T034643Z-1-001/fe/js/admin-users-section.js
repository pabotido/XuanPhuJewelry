function getAdminUserDisplayIdentity(user) {
    const fullName = String(user?.fullName || '').trim();
    const username = String(user?.username || '').trim();
    const email = String(user?.email || '').trim();

    const normalizedFullName = fullName.toLowerCase();
    const normalizedUsername = username.toLowerCase();
    const normalizedEmail = email.toLowerCase();

    if (fullName) {
        return {
            primaryText: fullName,
            secondaryText:
                username &&
                normalizedUsername !== normalizedFullName &&
                normalizedUsername !== normalizedEmail
                    ? username
                    : ''
        };
    }

    if (username && normalizedUsername !== normalizedEmail) {
        return {
            primaryText: username,
            secondaryText: ''
        };
    }

    return {
        primaryText: 'Khách chưa cập nhật tên',
        secondaryText: ''
    };
}

async function fetchAdminUsers() {
    const userList = document.getElementById('user-list');
    const usersFeedback = document.getElementById('users-feedback');
    if (!userList) return;

    userList.innerHTML = '<p class="gallery-message">Đang tải danh sách tài khoản...</p>';
    if (usersFeedback) {
        usersFeedback.textContent = '';
        usersFeedback.className = 'admin-feedback';
    }

    try {
        const response = await fetch(buildAdminApiUrl(ADMIN_USERS_API_URL), buildAdminRequestInit());
        const users = await handleAdminJsonResponse(response);

        if (!Array.isArray(users) || users.length === 0) {
            userList.innerHTML = '<p class="gallery-message is-empty">Chưa có tài khoản khách hàng nào.</p>';
            return;
        }

        userList.innerHTML = '';
        userList.appendChild(createAdminUsersTable(users));
    } catch (error) {
        console.error(error);
        userList.innerHTML = '<p class="gallery-message is-error">Không thể tải danh sách tài khoản.</p>';
        if (usersFeedback) {
            usersFeedback.textContent = error.message || 'Không thể tải dữ liệu tài khoản.';
            usersFeedback.classList.add('is-error');
        }
    }
}

function createAdminUsersTable(users) {
    const wrap = document.createElement('div');
    wrap.className = 'admin-table-wrap';

    const table = document.createElement('table');
    table.className = 'admin-data-table admin-user-table';
    table.innerHTML = `
        <thead>
            <tr>
                <th>ID</th>
                <th>Tên khách hàng</th>
                <th>Email</th>
                <th>Số điện thoại</th>
                <th>Số đơn đặt</th>
                <th>Tổng chi tiêu</th>
                <th>Ngày tạo</th>
                <th>Hành động</th>
            </tr>
        </thead>
        <tbody></tbody>
    `;

    const tbody = table.querySelector('tbody');
    users.forEach((user) => {
        const row = document.createElement('tr');
        row.className = 'admin-user-row';

        const detailRow = document.createElement('tr');
        detailRow.className = 'admin-user-detail-row d-none';
        detailRow.hidden = true;

        const createdAt = user.createdAt ? new Date(user.createdAt) : null;
        const userDate = createdAt && !Number.isNaN(createdAt.getTime())
            ? createdAt.toLocaleDateString('vi-VN')
            : '---';
        const userIdentity = getAdminUserDisplayIdentity(user);

        row.innerHTML = `
            <td>${escapeAdminHtml(user.id)}</td>
            <td class="admin-cell-name">
                <p class="admin-primary-text">${escapeAdminHtml(userIdentity.primaryText)}</p>
                ${userIdentity.secondaryText
                    ? `<p class="admin-secondary-text">${escapeAdminHtml(userIdentity.secondaryText)}</p>`
                    : ''}
            </td>
            <td class="admin-cell-email">
                <a href="mailto:${escapeAdminHtml(user.email)}">${escapeAdminHtml(user.email)}</a>
            </td>
            <td class="admin-cell-phone">${escapeAdminHtml(user.phone || '---')}</td>
            <td class="admin-cell-number">${escapeAdminHtml(user.orderCount || 0)}</td>
            <td class="admin-cell-total">
                <span class="admin-inline-total">${formatAdminCurrency(user.totalSpent || 0)}</span>
            </td>
            <td class="admin-cell-date">${escapeAdminHtml(userDate)}</td>
            <td class="admin-cell-actions">
                <div class="admin-actions admin-user-actions">
                    <button class="admin-table-btn" type="button" data-user-action="toggle-orders" aria-expanded="false">Lịch sử</button>
                    <button class="admin-table-btn edit" type="button" data-user-action="reset-password">Đổi MK</button>
                    <button class="admin-table-btn delete" type="button" data-user-action="delete-user">Xóa</button>
                </div>
            </td>
        `;

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

            syncToggleOrdersLabel();
            toggleOrdersBtn.addEventListener('click', () => {
                const nextHidden = !(detailRow.hidden || detailRow.classList.contains('d-none'));
                detailRow.hidden = nextHidden;
                detailRow.classList.toggle('d-none', nextHidden);
                syncToggleOrdersLabel();
            });
        }

        const resetPasswordBtn = row.querySelector('[data-user-action="reset-password"]');
        if (resetPasswordBtn) {
            resetPasswordBtn.addEventListener('click', () => resetAdminUserPassword(user));
        }

        const deleteBtn = row.querySelector('.admin-table-btn.delete');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => deleteAdminUser(user.id));
        }

        tbody.appendChild(row);
        tbody.appendChild(detailRow);
    });

    wrap.appendChild(table);
    return wrap;
}

function renderAdminUserOrders(orders) {
    if (!Array.isArray(orders) || orders.length === 0) {
        return '<p class="admin-user-orders-empty">Tài khoản này chưa có giao dịch nào.</p>';
    }

    return `
        <div class="admin-user-orders-list">
            ${orders.map((order) => {
                const itemCount = Array.isArray(order.items)
                    ? order.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
                    : 0;
                return `
                    <article class="admin-user-order-card">
                        <div class="admin-user-order-head">
                            <strong>${escapeAdminHtml(order.orderNumber || 'Đơn hàng')}</strong>
                            <span>${escapeAdminHtml(formatAdminDateTime(order.createdAt))}</span>
                        </div>
                        <p>${escapeAdminHtml(order.paymentMethod === 'bank' ? 'Chuyển khoản' : 'Thanh toán khi nhận hàng')}</p>
                        <p>${escapeAdminHtml(itemCount)} sản phẩm • ${formatAdminCurrency(order.totalAmount || 0)}</p>
                        <p>${escapeAdminHtml(order.customerAddress || 'Chưa có địa chỉ')}</p>
                    </article>
                `;
            }).join('')}
        </div>
    `;
}

async function resetAdminUserPassword(user) {
    const nextPassword = window.prompt(
        `Nhập mật khẩu mới cho ${user.email}.\nMật khẩu cũ sẽ bị thay thế ngay sau khi lưu.\nMật khẩu phải có ít nhất 6 ký tự.`
    );

    if (nextPassword === null) return;

    const trimmedPassword = nextPassword.trim();
    if (trimmedPassword.length < 6) {
        const usersFeedback = document.getElementById('users-feedback');
        if (usersFeedback) {
            usersFeedback.textContent = 'Mật khẩu mới phải có ít nhất 6 ký tự.';
            usersFeedback.className = 'admin-feedback is-error';
        }
        return;
    }

    const confirmedPassword = window.prompt(
        `Nhập lại mật khẩu mới cho ${user.email} để xác nhận.`
    );

    if (confirmedPassword === null) return;

    if (trimmedPassword !== confirmedPassword.trim()) {
        const usersFeedback = document.getElementById('users-feedback');
        if (usersFeedback) {
            usersFeedback.textContent = 'Mật khẩu xác nhận không khớp.';
            usersFeedback.className = 'admin-feedback is-error';
        }
        return;
    }

    try {
        const response = await fetch(
            buildAdminApiUrl(`${ADMIN_USERS_API_URL}/${user.id}${ADMIN_RESET_PASSWORD_API_SUFFIX}`),
            buildAdminRequestInit({
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ newPassword: trimmedPassword })
            })
        );
        const result = await handleAdminJsonResponse(response);

        const usersFeedback = document.getElementById('users-feedback');
        if (usersFeedback) {
            usersFeedback.textContent = result.message || 'Đã reset mật khẩu.';
            usersFeedback.className = 'admin-feedback is-success';
        }
    } catch (error) {
        console.error(error);
        const usersFeedback = document.getElementById('users-feedback');
        if (usersFeedback) {
            usersFeedback.textContent = error.message || 'Không thể reset mật khẩu.';
            usersFeedback.className = 'admin-feedback is-error';
        }
    }
}

async function deleteAdminUser(userId) {
    if (!confirm('Hành động này không thể hoàn tác. Xóa tài khoản sẽ xóa mọi dữ liệu liên quan. Bạn chắc chứ?')) return;

    try {
        const response = await fetch(
            buildAdminApiUrl(`${ADMIN_USERS_API_URL}/${userId}`),
            buildAdminRequestInit({ method: 'DELETE' })
        );
        const result = await handleAdminJsonResponse(response);

        const usersFeedback = document.getElementById('users-feedback');
        if (usersFeedback) {
            usersFeedback.textContent = result.message || 'Đã xóa tài khoản.';
            usersFeedback.className = 'admin-feedback is-success';
        }

        fetchAdminUsers();
    } catch (error) {
        console.error(error);
        const usersFeedback = document.getElementById('users-feedback');
        if (usersFeedback) {
            usersFeedback.textContent = error.message || 'Không thể xóa tài khoản.';
            usersFeedback.className = 'admin-feedback is-error';
        }
    }
}
