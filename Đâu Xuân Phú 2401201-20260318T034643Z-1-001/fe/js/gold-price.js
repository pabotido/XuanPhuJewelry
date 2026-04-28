document.addEventListener('DOMContentLoaded', () => {
  fetchGoldPrices();

  const btn = document.getElementById('refresh-gold');
  if (btn) btn.addEventListener('click', fetchGoldPrices);
});

// ===== LƯU GIÁ CŨ (LOCAL STORAGE) =====
let lastPrices = JSON.parse(localStorage.getItem('goldPrices')) || {
  vang24k: 0,
  vang18k: 0,
  vang14k: 0,
  bac999: 0
};

// ===== FETCH API =====
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

      const p = res.prices;

      const btmc = p['BT9999NTT'];
      const sjc = p['SJC1L'];
      const pnj24k = p['PQHN24NTT'];

      const data = {
        vang24k: {
          buy: btmc?.buy || sjc?.buy || 0,
          sell: btmc?.sell || sjc?.sell || 0
        },
        vang18k: {
          buy: Math.round((pnj24k?.buy || 0) * 0.75),
          sell: Math.round((pnj24k?.sell || 0) * 0.75)
        },
        vang14k: {
          buy: Math.round((pnj24k?.buy || 0) * 0.583),
          sell: Math.round((pnj24k?.sell || 0) * 0.583)
        },
        bac999: {
          buy: 28000,
          sell: 29000
        }
      };

      updateTable(data);
    })
    .catch(err => {
      console.error(err);

      const status = document.querySelector('.price-status');
      if (status) {
        status.innerHTML = 'Không lấy được giá vàng. Hãy bấm <b>Làm mới</b>.';
        status.style.color = '#dc3545';
      }
    });
}

// ===== UPDATE TABLE =====
function updateTable(data) {
  const rows = document.querySelectorAll('.price-table tbody tr');

  if (rows.length < 4) return;

  updateRow(rows[0], data.vang24k, 'vang24k');
  updateRow(rows[1], data.vang18k, 'vang18k');
  updateRow(rows[2], data.vang14k, 'vang14k');
  updateRow(rows[3], data.bac999, 'bac999', false);

  // 👉 LƯU LẠI GIÁ
  localStorage.setItem('goldPrices', JSON.stringify(lastPrices));

  updateTime();
}

// ===== UPDATE TỪNG DÒNG =====
function updateRow(row, val, key, isGold = true) {
  const format = n => n > 0 ? n.toLocaleString('vi-VN') : '--';
  const toChi = n => n > 0 ? Math.round(n / 10) : 0;

  let buy = isGold ? toChi(val.buy) : val.buy;
  let sell = isGold ? toChi(val.sell) : val.sell;

  row.cells[1].textContent = format(buy);
  row.cells[2].textContent = format(sell);

  // 👉 TÍNH THAY ĐỔI TRƯỚC
  row.cells[3].innerHTML = getChange(buy, lastPrices[key]);

  highlight(row, buy, lastPrices[key]);

  // 👉 CẬP NHẬT GIÁ MỚI
  lastPrices[key] = buy;
}

// ===== HIỂN THỊ TĂNG GIẢM =====
function getChange(newVal, oldVal) {
  if (!oldVal) return '—';

  const diff = newVal - oldVal;

  if (diff > 0) {
    return `<span class="price-change up">▲ +${diff.toLocaleString('vi-VN')}</span>`;
  } else if (diff < 0) {
    return `<span class="price-change down">▼ -${Math.abs(diff).toLocaleString('vi-VN')}</span>`;
  } else {
    return '—';
  }
}

// ===== HIỆU ỨNG NHẤP NHÁY =====
function highlight(row, newVal, oldVal) {
  if (!oldVal) return;

  row.classList.remove('is-up', 'is-down');

  if (newVal > oldVal) {
    row.classList.add('is-up');
  } else if (newVal < oldVal) {
    row.classList.add('is-down');
  }

  setTimeout(() => {
    row.classList.remove('is-up', 'is-down');
  }, 800);
}

// ===== CẬP NHẬT THỜI GIAN =====
function updateTime() {
  const now = new Date();
  const status = document.querySelector('.price-status');
  const dateLabel = document.getElementById('gold-price-date');

  if (status) {
    status.textContent =
      `Cập nhật: ${now.toLocaleDateString('vi-VN')} - ${now.toLocaleTimeString('vi-VN')}`;
    status.style.color = '#28a745';
  }

  if (dateLabel) {
    dateLabel.textContent = `Ngày cập nhật: ${now.toLocaleDateString('vi-VN')}`;
  }
}

// ===== AUTO REFRESH =====
setInterval(fetchGoldPrices, 5 * 60 * 1000);
