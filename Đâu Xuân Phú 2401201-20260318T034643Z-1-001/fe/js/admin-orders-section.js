async function fetchAdminOrders() {
    const orderList = document.getElementById('order-list');
    const ordersFeedback = document.getElementById('orders-feedback');
    if (!orderList) return;

    orderList.innerHTML = '<p class="gallery-message">Đang tải đơn hàng...</p>';
    if (ordersFeedback) {
        ordersFeedback.textContent = '';
        ordersFeedback.className = 'admin-feedback';
    }

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
        if (ordersFeedback) {
            ordersFeedback.textContent = error.message || 'Không thể tải dữ liệu đơn hàng.';
            ordersFeedback.classList.add('is-error');
        }
    }
}

function createAdminOrdersTable(orders) {
    const wrap = document.createElement('div');
    wrap.className = 'admin-table-wrap';

    const table = document.createElement('table');
    table.className = 'admin-data-table';
    table.innerHTML = `
        <thead>
            <tr>
                <th>Mã đơn</th>
                <th>Khách hàng</th>
                <th>Thanh toán</th>
                <th>Tổng tiền</th>
                <th>Sản phẩm</th>
                <th>Trạng thái</th>
                <th>Ngày tạo</th>
            </tr>
        </thead>
        <tbody></tbody>
    `;

    const tbody = table.querySelector('tbody');
    orders.forEach((order) => {
        const row = document.createElement('tr');
        const createdAt = order.createdAt ? new Date(order.createdAt) : null;
        const orderDate = createdAt && !Number.isNaN(createdAt.getTime())
            ? createdAt.toLocaleString('vi-VN')
            : '---';
        const itemCount = Array.isArray(order.items) ? order.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0) : 0;
        const paymentLabel = order.paymentMethod === 'bank' ? 'Chuyển khoản' : 'Thanh toán khi nhận hàng';

        row.innerHTML = `
            <td><p class="admin-primary-text">${escapeAdminHtml(order.orderNumber || '---')}</p></td>
            <td class="admin-cell-name">
                <p class="admin-primary-text">${escapeAdminHtml(order.customerName || '---')}</p>
                <p class="admin-secondary-text">${escapeAdminHtml(order.customerPhone || '---')} · ${escapeAdminHtml(order.customerAddress || '---')}</p>
            </td>
            <td><span class="admin-badge is-alt">${escapeAdminHtml(paymentLabel)}</span></td>
            <td><span class="admin-inline-total">${formatAdminCurrency(order.totalAmount)}</span></td>
            <td>${escapeAdminHtml(itemCount || 0)} sản phẩm</td>
            <td>${renderAdminStatusBadge(order.status)}</td>
            <td>${escapeAdminHtml(orderDate)}</td>
        `;
        tbody.appendChild(row);
    });

    wrap.appendChild(table);
    return wrap;
}
