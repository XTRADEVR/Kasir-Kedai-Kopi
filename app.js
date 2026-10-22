// Registrasi Service Worker PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(err => console.error('SW Failed:', err));
  });
}

// STATE MANAGEMENT
const STATE = {
  menus: [],
  categories: [],
  users: [],
  currentUser: null,
  cart: [],
  transactions: [],
  activeCategory: 'Semua',
  searchQuery: '',
  activePaymentMethod: 'Tunai'
};

// FORMAT RUPIAH
const formatIDR = (num) => 'Rp ' + Number(num || 0).toLocaleString('id-ID');

// INISIALISASI DATA
async function initApp() {
  // Splashscreen Dismiss Timer (Simulasi Inisialisasi Mulus)
  setTimeout(() => {
    const splash = document.getElementById('splash-screen');
    splash.classList.add('hidden');
    // Hilangkan Shimmer setelah memuat data
    toggleShimmer(false);
  }, 1200);

  toggleShimmer(true);

  // Ambil Data dari LocalStorage atau Fetch app-data.json
  const localMenus = localStorage.getItem('kopipos_menus');
  const localTransactions = localStorage.getItem('kopipos_transactions');
  const localUser = localStorage.getItem('kopipos_user');

  try {
    const res = await fetch('./app-data.json');
    const data = await res.json();
    
    STATE.categories = data.categories;
    STATE.menus = localMenus ? JSON.parse(localMenus) : data.menus;
    STATE.users = data.users;
    STATE.transactions = localTransactions ? JSON.parse(localTransactions) : [];
    STATE.currentUser = localUser ? JSON.parse(localUser) : data.users[1]; // Default Kasir
  } catch (err) {
    console.warn('Offline mode/File fetch failed, using fallback empty state');
    STATE.categories = ["Semua", "Kopi", "Non-Kopi", "Teh", "Minuman Dingin", "Snack"];
    STATE.menus = localMenus ? JSON.parse(localMenus) : [];
    STATE.transactions = localTransactions ? JSON.parse(localTransactions) : [];
    STATE.currentUser = { id: "u2", name: "Kasir", role: "kasir" };
  }

  setupEventListeners();
  renderDate();
  renderRoleBadge();
  renderCategories();
  renderMenus();
  renderCart();
  lucide.createIcons();
}

function toggleShimmer(show) {
  const shimmer = document.getElementById('menu-shimmer');
  const menuGrid = document.getElementById('menu-grid-container');
  if (show) {
    shimmer.style.display = 'grid';
    menuGrid.style.display = 'none';
  } else {
    shimmer.style.display = 'none';
    menuGrid.style.display = 'grid';
  }
}

function renderDate() {
  const options = { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' };
  document.getElementById('date-display').innerText = new Date().toLocaleDateString('id-ID', options);
}

// ROLE & USER MANAGEMENT
function renderRoleBadge() {
  const badge = document.getElementById('current-role-badge');
  badge.innerText = `Role: ${STATE.currentUser.role.toUpperCase()}`;
  badge.style.color = STATE.currentUser.role === 'admin' ? 'var(--primary)' : 'var(--text-muted)';

  // Sembunyikan/Tampilkan tab admin bila perlu
  const adminTab = document.querySelector('[data-tab="manage-menu"]');
  if (adminTab) {
    adminTab.style.display = STATE.currentUser.role === 'admin' ? 'flex' : 'none';
  }
}

function switchUserRole() {
  if (STATE.currentUser.role === 'kasir') {
    const pass = prompt('Masukkan PIN Admin (Default: 1234):');
    if (pass === '1234') {
      STATE.currentUser = STATE.users.find(u => u.role === 'admin') || { role: 'admin', name: 'Admin' };
      alert('Berhasil beralih ke Admin!');
    } else {
      alert('PIN Salah!');
      return;
    }
  } else {
    STATE.currentUser = STATE.users.find(u => u.role === 'kasir') || { role: 'kasir', name: 'Kasir' };
    alert('Beralih ke mode Kasir.');
  }
  localStorage.setItem('kopipos_user', JSON.stringify(STATE.currentUser));
  renderRoleBadge();
  // Alihkan view jika kasir membuka view khusus admin
  if (STATE.currentUser.role !== 'admin') {
    switchTab('pos');
  }
}

// RENDER KATEGORI
function renderCategories() {
  const bar = document.getElementById('category-bar');
  bar.innerHTML = STATE.categories.map(cat => `
    <button class="cat-btn ${cat === STATE.activeCategory ? 'active' : ''}" data-cat="${cat}">
      ${cat}
    </button>
  `).join('');
}

// RENDER MENU GRID
function renderMenus() {
  const container = document.getElementById('menu-grid-container');
  let filtered = STATE.menus;

  if (STATE.activeCategory !== 'Semua') {
    filtered = filtered.filter(m => m.category === STATE.activeCategory);
  }

  if (STATE.searchQuery.trim() !== '') {
    filtered = filtered.filter(m => m.name.toLowerCase().includes(STATE.searchQuery.toLowerCase()));
  }

  if (filtered.length === 0) {
    container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px;">Menu tidak ditemukan</div>`;
    return;
  }

  container.innerHTML = filtered.map(item => `
    <div class="menu-card" onclick="addToCart('${item.id}')">
      <img src="${item.image}" alt="${item.name}" class="menu-thumb" loading="lazy">
      <div class="menu-info">
        <span class="menu-cat-badge">${item.category}</span>
        <h4 class="menu-title">${item.name}</h4>
        <div class="menu-bottom">
          <span class="menu-price">${formatIDR(item.price)}</span>
          <button class="add-btn" title="Tambah item"><i data-lucide="plus" style="width:18px;height:18px;"></i></button>
        </div>
      </div>
    </div>
  `).join('');

  lucide.createIcons();
}

// CART MANAGEMENT
function addToCart(menuId) {
  const item = STATE.menus.find(m => m.id === menuId);
  if (!item) return;

  const exist = STATE.cart.find(c => c.id === menuId);
  if (exist) {
    exist.qty += 1;
  } else {
    STATE.cart.push({ ...item, qty: 1 });
  }
  renderCart();
}

function updateCartQty(menuId, change) {
  const itemIndex = STATE.cart.findIndex(c => c.id === menuId);
  if (itemIndex > -1) {
    STATE.cart[itemIndex].qty += change;
    if (STATE.cart[itemIndex].qty <= 0) {
      STATE.cart.splice(itemIndex, 1);
    }
  }
  renderCart();
}

function renderCart() {
  const container = document.getElementById('cart-items-container');
  const btnCheckout = document.getElementById('btn-to-payment');
  const mobileCount = document.getElementById('mobile-cart-count');

  if (STATE.cart.length === 0) {
    container.innerHTML = `<div style="text-align: center; color: var(--text-muted); margin-top: 40px;">Keranjang kosong</div>`;
    document.getElementById('cart-subtotal').innerText = 'Rp 0';
    document.getElementById('cart-tax').innerText = 'Rp 0';
    document.getElementById('cart-grandtotal').innerText = 'Rp 0';
    btnCheckout.disabled = true;
    mobileCount.innerText = '0 Item';
    return;
  }

  let subtotal = 0;
  let totalCount = 0;

  container.innerHTML = STATE.cart.map(item => {
    const itemTotal = item.price * item.qty;
    subtotal += itemTotal;
    totalCount += item.qty;

    return `
      <div class="cart-item">
        <div style="flex:1;">
          <h5 style="font-size:0.95rem; font-weight:600;">${item.name}</h5>
          <span style="font-size:0.8rem; color:var(--text-muted);">${formatIDR(item.price)}</span>
        </div>
        <div class="qty-control">
          <button class="qty-btn" onclick="updateCartQty('${item.id}', -1)">-</button>
          <span style="font-weight:600; font-size:0.9rem;">${item.qty}</span>
          <button class="qty-btn" onclick="updateCartQty('${item.id}', 1)">+</button>
        </div>
      </div>
    `;
  }).join('');

  const tax = Math.round(subtotal * 0.1); // PB1 10%
  const grandTotal = subtotal + tax;

  document.getElementById('cart-subtotal').innerText = formatIDR(subtotal);
  document.getElementById('cart-tax').innerText = formatIDR(tax);
  document.getElementById('cart-grandtotal').innerText = formatIDR(grandTotal);
  mobileCount.innerText = `${totalCount} Item`;
  btnCheckout.disabled = false;
}

// CHECKOUT & CALCULATOR SYSTEM
function openCheckoutModal() {
  const subtotal = STATE.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const grandTotal = subtotal + Math.round(subtotal * 0.1);

  document.getElementById('modal-bill-amount').innerText = formatIDR(grandTotal);
  document.getElementById('input-cash-received').value = '';
  document.getElementById('cash-change-display').innerText = 'Rp 0';
  
  openModal('checkout-modal');
  calculateChange();
}

function calculateChange() {
  const subtotal = STATE.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const grandTotal = subtotal + Math.round(subtotal * 0.1);
  const cashGiven = Number(document.getElementById('input-cash-received').value) || 0;
  const changeDisplay = document.getElementById('cash-change-display');

  if (cashGiven >= grandTotal) {
    changeDisplay.innerText = formatIDR(cashGiven - grandTotal);
    changeDisplay.style.color = "var(--success)";
  } else {
    changeDisplay.innerText = "Nominal Kurang";
    changeDisplay.style.color = "var(--danger)";
  }
}

function processPayment() {
  const subtotal = STATE.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const tax = Math.round(subtotal * 0.1);
  const grandTotal = subtotal + tax;
  const cashGiven = Number(document.getElementById('input-cash-received').value) || grandTotal;

  if (STATE.activePaymentMethod === 'Tunai' && cashGiven < grandTotal) {
    alert('Uang tunai yang dimasukkan kurang dari total belanja!');
    return;
  }

  const transactionData = {
    id: 'TRX-' + Date.now().toString().slice(-6),
    date: new Date().toISOString(),
    cashier: STATE.currentUser.name,
    items: [...STATE.cart],
    subtotal: subtotal,
    tax: tax,
    grandTotal: grandTotal,
    paymentMethod: STATE.activePaymentMethod,
    cashReceived: STATE.activePaymentMethod === 'Tunai' ? cashGiven : grandTotal,
    change: STATE.activePaymentMethod === 'Tunai' ? (cashGiven - grandTotal) : 0
  };

  // Simpan Transaksi
  STATE.transactions.push(transactionData);
  localStorage.setItem('kopipos_transactions', JSON.stringify(STATE.transactions));

  closeModal('checkout-modal');
  showReceipt(transactionData);

  // Bersihkan Keranjang
  STATE.cart = [];
  renderCart();
}

function showReceipt(trx) {
  const container = document.getElementById('printable-receipt');
  container.innerHTML = `
    <div style="font-weight:bold; font-size:1.1rem; margin-bottom:4px;">KOPIPOS ARTISAN COFFEE</div>
    <div>Jl. Kemang Raya No. 12, Jakarta Selatan</div>
    <div>----------------------------------------</div>
    <div style="display:flex; justify-content:space-between;">
      <span>No: ${trx.id}</span>
      <span>${new Date(trx.date).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'})}</span>
    </div>
    <div style="text-align:left;">Kasir: ${trx.cashier}</div>
    <div>----------------------------------------</div>
    <div style="text-align:left;">
      ${trx.items.map(it => `
        <div style="display:flex; justify-content:space-between; margin: 3px 0;">
          <span>${it.name} x${it.qty}</span>
          <span>${formatIDR(it.price * it.qty)}</span>
        </div>
      `).join('')}
    </div>
    <div>----------------------------------------</div>
    <div style="display:flex; justify-content:space-between;"><span>Subtotal:</span><span>${formatIDR(trx.subtotal)}</span></div>
    <div style="display:flex; justify-content:space-between;"><span>PB1 (10%):</span><span>${formatIDR(trx.tax)}</span></div>
    <div style="display:flex; justify-content:space-between; font-weight:bold; font-size:1rem;"><span>TOTAL:</span><span>${formatIDR(trx.grandTotal)}</span></div>
    <div style="display:flex; justify-content:space-between;"><span>Bayar (${trx.paymentMethod}):</span><span>${formatIDR(trx.cashReceived)}</span></div>
    <div style="display:flex; justify-content:space-between;"><span>Kembali:</span><span>${formatIDR(trx.change)}</span></div>
    <div>----------------------------------------</div>
    <div style="text-align:center; margin-top:8px;">Terima kasih atas kunjungan Anda!</div>
  `;
  openModal('receipt-modal');
}

// LAPORAN PENJUALAN HARIAN
function renderReportView() {
  const revElem = document.getElementById('report-total-revenue');
  const trxElem = document.getElementById('report-total-transactions');
  const itemsElem = document.getElementById('report-total-items');
  const bestElem = document.getElementById('report-bestsellers');

  const totalRev = STATE.transactions.reduce((sum, t) => sum + t.grandTotal, 0);
  const totalTrx = STATE.transactions.length;
  
  let totalItemsCount = 0;
  const itemMap = {};

  STATE.transactions.forEach(t => {
    t.items.forEach(it => {
      totalItemsCount += it.qty;
      itemMap[it.name] = (itemMap[it.name] || 0) + it.qty;
    });
  });

  revElem.innerText = formatIDR(totalRev);
  trxElem.innerText = totalTrx;
  itemsElem.innerText = `${totalItemsCount} pcs`;

  const sortedBest = Object.entries(itemMap).sort((a, b) => b[1] - a[1]);

  if (sortedBest.length === 0) {
    bestElem.innerHTML = `<p style="color: var(--text-muted);">Belum ada produk terjual hari ini.</p>`;
  } else {
    bestElem.innerHTML = sortedBest.map(([name, qty], index) => `
      <div style="display:flex; justify-content:space-between; padding: 10px 0; border-bottom: 1px solid var(--border-color);">
        <span>${index + 1}. ${name}</span>
        <strong style="color: var(--primary);">${qty} Terjual</strong>
      </div>
    `).join('');
  }
}

// MANAJEMEN MENU (ADMIN CRUD)
function renderAdminMenuList() {
  const container = document.getElementById('admin-menu-list');
  container.innerHTML = STATE.menus.map(item => `
    <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-card); padding:12px 16px; border-radius:var(--radius-md); border:1px solid var(--border-color);">
      <div style="display:flex; align-items:center; gap:14px;">
        <img src="${item.image}" style="width:48px; height:48px; border-radius:8px; object-fit:cover;">
        <div>
          <h4 style="font-size:1rem;">${item.name}</h4>
          <span style="font-size:0.8rem; color:var(--text-muted);">${item.category} • ${formatIDR(item.price)}</span>
        </div>
      </div>
      <div style="display:flex; gap:8px;">
        <button onclick="openEditMenu('${item.id}')" style="background:none; border:1px solid var(--border-color); color:var(--primary); padding:6px 12px; border-radius:6px; cursor:pointer;">Edit</button>
        <button onclick="deleteMenu('${item.id}')" style="background:none; border:1px solid var(--danger); color:var(--danger); padding:6px 12px; border-radius:6px; cursor:pointer;">Hapus</button>
      </div>
    </div>
  `).join('');
}

function openEditMenu(id) {
  const item = STATE.menus.find(m => m.id === id);
  if (!item) return;

  document.getElementById('menu-modal-title').innerText = 'Edit Menu Minuman';
  document.getElementById('menu-form-id').value = item.id;
  document.getElementById('menu-form-name').value = item.name;
  document.getElementById('menu-form-category').value = item.category;
  document.getElementById('menu-form-price').value = item.price;
  document.getElementById('menu-form-image').value = item.image;

  openModal('menu-modal');
}

function deleteMenu(id) {
  if (confirm('Yakin ingin menghapus item menu ini?')) {
    STATE.menus = STATE.menus.filter(m => m.id !== id);
    localStorage.setItem('kopipos_menus', JSON.stringify(STATE.menus));
    renderAdminMenuList();
    renderMenus();
  }
}

// EVENT LISTENERS & NAVIGATION
function setupEventListeners() {
  // Tabs Switcher
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const tab = item.getAttribute('data-tab');
      switchTab(tab);
    });
  });

  // Role Toggle
  document.getElementById('role-toggle-btn').addEventListener('click', switchUserRole);

  // Kategori Bar Click
  document.getElementById('category-bar').addEventListener('click', (e) => {
    if (e.target.classList.contains('cat-btn')) {
      document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      STATE.activeCategory = e.target.getAttribute('data-cat');
      renderMenus();
    }
  });

  // Pencarian Menu
  document.getElementById('search-menu-input').addEventListener('input', (e) => {
    STATE.searchQuery = e.target.value;
    renderMenus();
  });

  // Kosongkan Cart
  document.getElementById('btn-clear-cart').addEventListener('click', () => {
    if (STATE.cart.length > 0 && confirm('Kosongkan semua pesanan?')) {
      STATE.cart = [];
      renderCart();
    }
  });

  // Buka Modal Checkout
  document.getElementById('btn-to-payment').addEventListener('click', openCheckoutModal);

  // Metode Pembayaran Click
  document.querySelectorAll('.pay-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.pay-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      STATE.activePaymentMethod = btn.getAttribute('data-method');

      const isCash = STATE.activePaymentMethod === 'Tunai';
      document.getElementById('cash-calculator-section').style.display = isCash ? 'block' : 'none';
      document.getElementById('non-cash-section').style.display = isCash ? 'none' : 'block';

      if (!isCash) {
        document.getElementById('non-cash-desc').innerText = `Selesaikan pembayaran via ${STATE.activePaymentMethod}`;
      }
    });
  });

  // Input Cash Dinamis
  const cashInput = document.getElementById('input-cash-received');
  cashInput.addEventListener('input', calculateChange);

  // Chip Cepat Uang
  document.querySelectorAll('.cash-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const subtotal = STATE.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
      const grandTotal = subtotal + Math.round(subtotal * 0.1);
      const val = chip.getAttribute('data-val');

      if (val === 'exact') {
        cashInput.value = grandTotal;
      } else {
        cashInput.value = val;
      }
      calculateChange();
    });
  });

  // Proses Bayar
  document.getElementById('btn-process-pay').addEventListener('click', processPayment);

  // Modal Tambah Menu Admin
  document.getElementById('btn-open-add-menu').addEventListener('click', () => {
    document.getElementById('menu-modal-title').innerText = 'Tambah Menu Baru';
    document.getElementById('menu-form').reset();
    document.getElementById('menu-form-id').value = '';
    openModal('menu-modal');
  });

  // Form Menu Submit (Add/Edit)
  document.getElementById('menu-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('menu-form-id').value;
    const name = document.getElementById('menu-form-name').value;
    const category = document.getElementById('menu-form-category').value;
    const price = Number(document.getElementById('menu-form-price').value);
    const image = document.getElementById('menu-form-image').value;

    if (id) {
      // Edit
      const index = STATE.menus.findIndex(m => m.id === id);
      if (index > -1) {
        STATE.menus[index] = { id, name, category, price, image };
      }
    } else {
      // Tambah Baru
      STATE.menus.push({ id: 'm-' + Date.now(), name, category, price, image });
    }

    localStorage.setItem('kopipos_menus', JSON.stringify(STATE.menus));
    closeModal('menu-modal');
    renderAdminMenuList();
    renderMenus();
  });

  // Mobile Drawer Toggle
  document.getElementById('mobile-cart-btn').addEventListener('click', () => {
    document.getElementById('cart-sidebar').classList.toggle('open');
  });
}

function switchTab(tabId) {
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');

  document.getElementById('view-pos').style.display = tabId === 'pos' ? 'block' : 'none';
  document.getElementById('view-report').style.display = tabId === 'report' ? 'block' : 'none';
  document.getElementById('view-manage-menu').style.display = tabId === 'manage-menu' ? 'block' : 'none';

  if (tabId === 'report') renderReportView();
  if (tabId === 'manage-menu') renderAdminMenuList();
}

function openModal(id) {
  document.getElementById(id).classList.add('open');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

// Eksekusi Saat Dokumen Siap
document.addEventListener('DOMContentLoaded', initApp);
