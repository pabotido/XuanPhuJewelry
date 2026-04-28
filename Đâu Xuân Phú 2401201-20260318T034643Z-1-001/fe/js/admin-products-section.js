function getAdminForm() {
    return {
        category: document.getElementById('prod-category'),
        description: document.getElementById('prod-description'),
        file: document.getElementById('prod-file'),
        form: document.getElementById('productForm'),
        id: document.getElementById('prod-id'),
        imageUrl: document.getElementById('prod-img'),
        material: document.getElementById('prod-material'),
        name: document.getElementById('prod-name'),
        previewImage: document.getElementById('prod-preview'),
        previewPlaceholder: document.getElementById('prod-preview-placeholder'),
        previewShell: document.getElementById('prod-preview-shell'),
        price: document.getElementById('prod-price'),
        sku: document.getElementById('prod-sku'),
        weight: document.getElementById('prod-weight')
    };
}

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

function createAdminProductTable(products) {
    const wrap = document.createElement('div');
    wrap.className = 'admin-table-wrap';

    const table = document.createElement('table');
    table.className = 'admin-data-table';
    table.innerHTML = `
        <thead>
            <tr>
                <th>ID</th>
                <th>Mã sản phẩm</th>
                <th>Tên sản phẩm</th>
                <th>Nhóm hiển thị</th>
                <th>Đơn giá</th>
                <th>Chất liệu</th>
                <th>Hình ảnh</th>
                <th>Action</th>
            </tr>
        </thead>
        <tbody></tbody>
    `;

    const tbody = table.querySelector('tbody');

    products.forEach((product) => {
        const category = ADMIN_ALLOWED_CATEGORIES.includes(product.Category) ? product.Category : 'Phổ biến';
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${escapeAdminHtml(product.Id)}</td>
            <td>${escapeAdminHtml(product.Sku || '---')}</td>
            <td class="admin-cell-name">
                <p class="admin-primary-text">${escapeAdminHtml(product.Name)}</p>
                <p class="admin-secondary-text">${escapeAdminHtml(truncateAdminText(product.Description || 'Chưa có mô tả chi tiết.', 84))}</p>
            </td>
            <td><span class="admin-badge">${escapeAdminHtml(category)}</span></td>
            <td><span class="admin-inline-total">${formatAdminCurrency(product.Price)}</span></td>
            <td>${escapeAdminHtml(product.Material || 'Chưa cập nhật')}</td>
            <td class="admin-cell-thumb">
                <img src="${escapeAdminHtml(resolveAdminAssetUrl(product.ImageUrl))}" alt="${escapeAdminHtml(product.Name)}">
            </td>
            <td>
                <div class="admin-actions">
                    <button class="admin-table-btn edit" type="button">Sửa</button>
                    <button class="admin-table-btn delete" type="button">Xóa</button>
                </div>
            </td>
        `;

        const image = row.querySelector('img');
        if (image) attachAdminImageFallback(image, ADMIN_FALLBACK_IMAGE);

        const buttons = row.querySelectorAll('.admin-table-btn');
        buttons[0].addEventListener('click', () => openAdminEditModal(product));
        buttons[1].addEventListener('click', () => deleteAdminProduct(product.Id));
        tbody.appendChild(row);
    });

    wrap.appendChild(table);
    return wrap;
}

function openAddModal() {
    const { category, file, form, id } = getAdminForm();
    const modal = getAdminModal();
    if (!category || !form || !id || !modal) return;

    document.getElementById('modalTitle').innerText = 'Thêm sản phẩm mới';
    id.value = '';
    form.reset();
    category.value = 'Phổ biến';
    if (file) file.value = '';
    setAdminPreviewSource('');
    modal.show();
}

function openAdminEditModal(product) {
    const modal = getAdminModal();
    const form = getAdminForm();
    if (!modal || !form.id || !form.name || !form.price || !form.category) return;

    document.getElementById('modalTitle').innerText = 'Cập nhật sản phẩm';
    form.id.value = product.Id;
    form.name.value = product.Name || '';
    form.price.value = Number.isFinite(product.Price) ? product.Price : 0;
    form.sku.value = product.Sku || '';
    form.material.value = product.Material || '';
    form.weight.value = product.Weight || '';
    form.description.value = product.Description || '';
    form.imageUrl.value = product.ImageUrl || '';
    form.category.value = ADMIN_ALLOWED_CATEGORIES.includes(product.Category) ? product.Category : 'Phổ biến';
    if (form.file) form.file.value = '';
    setAdminPreviewSource(product.ImageUrl || '');
    modal.show();
}

async function saveAdminProduct() {
    const form = getAdminForm();
    if (!form.id || !form.name || !form.price || !form.imageUrl || !form.file || !form.category) return;

    const name = form.name.value.trim();
    const imageUrl = form.imageUrl.value.trim();
    const price = Number(form.price.value);
    const category = form.category.value;
    const selectedFile = form.file.files?.[0] || null;

    if (!name || !ADMIN_ALLOWED_CATEGORIES.includes(category) || !Number.isFinite(price) || price < 0) {
        writeAdminFeedback('Vui lòng nhập tên, giá và nhóm hiển thị hợp lệ.', 'error');
        return;
    }

    if (!imageUrl && !selectedFile) {
        writeAdminFeedback('Vui lòng nhập link ảnh hoặc chọn file ảnh từ máy.', 'error');
        return;
    }

    if (selectedFile && selectedFile.size > ADMIN_MAX_UPLOAD_SIZE) {
        writeAdminFeedback('Ảnh upload quá lớn. Hãy chọn file nhỏ hơn 5MB.', 'error');
        return;
    }

    const payload = {
        category,
        imageUrl,
        metadata: {
            description: form.description.value.trim(),
            material: form.material.value.trim(),
            price,
            sku: form.sku.value.trim(),
            weight: form.weight.value.trim()
        },
        name
    };

    if (selectedFile) {
        payload.uploadedImage = {
            dataUrl: await readAdminFileAsDataUrl(selectedFile),
            fileName: selectedFile.name,
            mimeType: selectedFile.type
        };
    }

    const isEdit = form.id.value !== '';
    const method = isEdit ? 'PUT' : 'POST';
    const url = isEdit ? `${ADMIN_API_URL}/${form.id.value}` : ADMIN_API_URL;

    try {
        const response = await fetch(buildAdminApiUrl(url), buildAdminRequestInit({
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }));

        const result = await handleAdminJsonResponse(response);
        writeAdminFeedback(result.message || 'Lưu sản phẩm thành công.', 'success');
        const modal = getAdminModal();
        if (modal) modal.hide();
        fetchAdminProducts();
    } catch (error) {
        console.error(error);
        writeAdminFeedback(error.message || 'Không thể lưu sản phẩm.', 'error');
    }
}

async function deleteAdminProduct(productId) {
    if (!confirm('Hành động này không thể hoàn tác. Bạn muốn xóa sản phẩm này?')) return;

    try {
        const response = await fetch(buildAdminApiUrl(`${ADMIN_API_URL}/${productId}`), buildAdminRequestInit({ method: 'DELETE' }));
        const result = await handleAdminJsonResponse(response);
        writeAdminFeedback(result.message || 'Đã xóa sản phẩm.', 'success');
        fetchAdminProducts();
    } catch (error) {
        console.error(error);
        writeAdminFeedback(error.message || 'Không thể xóa sản phẩm.', 'error');
    }
}

function syncAdminPreviewFromInputs() {
    const { file, imageUrl } = getAdminForm();
    if (!file || !imageUrl) return;

    if (file.files?.length) {
        updateAdminPreviewFromFile(file.files[0]);
        return;
    }

    setAdminPreviewSource(imageUrl.value.trim());
}

function updateAdminPreviewFromFile(file) {
    if (!file) {
        setAdminPreviewSource('');
        return;
    }

    clearAdminPreviewObjectUrl();
    const objectUrl = URL.createObjectURL(file);
    setAdminPreviewObjectUrl(objectUrl);
    setAdminPreviewSource(objectUrl);
}

function setAdminPreviewSource(src) {
    const { previewImage, previewPlaceholder, previewShell } = getAdminForm();
    if (!previewImage || !previewPlaceholder || !previewShell) return;

    if (!src) {
        previewImage.removeAttribute('src');
        previewShell.classList.remove('has-image');
        previewPlaceholder.textContent = 'Chưa chọn ảnh.';
        return;
    }

    previewImage.src = src;
    previewShell.classList.add('has-image');
    previewPlaceholder.textContent = 'Ảnh xem trước';
}

function readAdminFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Không thể đọc file ảnh đã chọn.'));
        reader.readAsDataURL(file);
    });
}

window.openAddModal = openAddModal;
