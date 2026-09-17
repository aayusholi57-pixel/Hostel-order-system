const API_URL = window.location.port === '5500' ? 'http://localhost:8000/api' : '/api';

function getCart() {
  try {
    return JSON.parse(localStorage.getItem('hotel_cart') || '[]');
  } catch (_) {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem('hotel_cart', JSON.stringify(cart));
  updateCartBadge();
}

function currentUser() {
  try {
    return JSON.parse(localStorage.getItem('hotel_current_user') || 'null');
  } catch (_) {
    return null;
  }
}

function setCurrentUser(user) {
  if (user) {
    localStorage.setItem('hotel_current_user', JSON.stringify(user));
  } else {
    localStorage.removeItem('hotel_current_user');
  }
  updateAuthUI();
}

function money(value) {
  const amount = Number(value || 0);
  return `Rs. ${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  }[char]));
}

function showToast(message, type = 'success') {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    document.body.appendChild(el);
  }

  el.textContent = message;
  el.className = `toast show ${type}`;
  clearTimeout(window.hotelToastTimer);
  window.hotelToastTimer = setTimeout(() => {
    el.className = 'toast';
  }, 2800);
}

function cartCount() {
  return getCart().reduce((sum, item) => sum + Number(item.qty || 0), 0);
}

function updateCartBadge() {
  document.querySelectorAll('#cart-count').forEach((badge) => {
    badge.textContent = cartCount();
  });
}

function updateAuthUI() {
  const user = currentUser();
  document.querySelectorAll('[data-auth-name]').forEach((el) => {
    el.textContent = user ? (user.name || 'Account').split(' ')[0] : 'Login';
  });

  document.querySelectorAll('[data-logout]').forEach((el) => {
    el.style.display = user ? 'inline-flex' : 'none';
  });
}

function initNav() {
  const toggle = document.getElementById('menu-toggle');
  const links = document.getElementById('nav-links');

  toggle?.addEventListener('click', () => {
    links?.classList.toggle('show');
  });

  updateCartBadge();
  updateAuthUI();

  document.querySelectorAll('[data-logout]').forEach((el) => {
    el.addEventListener('click', (event) => {
      event.preventDefault();
      localStorage.removeItem('hotel_token');
      setCurrentUser(null);
      showToast('Logged out');
      setTimeout(() => { window.location.href = 'index.html'; }, 250);
    });
  });
}

function addCartItem(item) {
  if (!item || item.id == null) return;

  const cart = getCart();
  const existing = cart.find((entry) => Number(entry.id) === Number(item.id));

  if (existing) {
    existing.qty = Number(existing.qty || 0) + 1;
  } else {
    cart.push({
      id: Number(item.id),
      name: item.name,
      price: Number(item.price),
      category: item.category,
      description: item.description || '',
      image: item.image || '',
      qty: 1,
    });
  }

  saveCart(cart);
  showToast(`${item.name} added to cart`);
}

function changeQty(id, delta) {
  const cart = getCart();
  const item = cart.find((entry) => Number(entry.id) === Number(id));
  if (!item) return;

  item.qty = Number(item.qty || 0) + Number(delta || 0);

  if (item.qty <= 0) {
    const index = cart.indexOf(item);
    if (index >= 0) cart.splice(index, 1);
  }

  saveCart(cart);
  if (typeof window.renderCart === 'function') window.renderCart();
  if (typeof window.renderCheckout === 'function') window.renderCheckout();
}

function cartDetailed() {
  return getCart()
    .map((item) => ({
      ...item,
      id: Number(item.id),
      price: Number(item.price || 0),
      qty: Number(item.qty || 1),
      description: item.description || item.desc || '',
      image: item.image || '',
    }))
    .filter((item) => item.id > 0 && item.name);
}

function subtotal() {
  return cartDetailed().reduce(
    (sum, item) => sum + Number(item.price) * Number(item.qty),
    0,
  );
}

function getDeliveryCharge() {
  const amount = subtotal();
  if (amount === 0 || amount > 1000) return 0;
  return 80;
}

function total() {
  return subtotal() + getDeliveryCharge();
}

async function apiRequest(path, options = {}) {
  const token = localStorage.getItem('hotel_token');
  const headers = { ...(options.headers || {}) };

  if (!headers['Content-Type'] && options.body) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  let data = {};
  try {
    data = await response.json();
  } catch (_) {
    data = {};
  }

  if (!response.ok) {
    throw new Error(data.message || `Request failed (${response.status})`);
  }

  return data;
}

function openFoodModal(item) {
  const modal = document.getElementById('food-modal');
  if (!modal || !item) return;

  const hero = modal.querySelector('.detail-hero');
  const name = modal.querySelector('[data-detail-name]');
  const desc = modal.querySelector('[data-detail-desc]');
  const price = modal.querySelector('[data-detail-price]');
  const category = modal.querySelector('[data-detail-category]');
  const add = modal.querySelector('[data-detail-add]');

  if (hero) {
    hero.innerHTML = item.image
      ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}">`
      : '<span>🍽️</span>';
  }
  if (name) name.textContent = item.name || '';
  if (desc) desc.textContent = item.description || '';
  if (price) price.textContent = money(item.price);
  if (category) category.textContent = item.category || '';

  if (add) {
    add.onclick = () => {
      addCartItem(item);
      closeModal();
    };
  }

  modal.classList.add('show');
}

function closeModal() {
  document.querySelectorAll('.modal').forEach((modal) => modal.classList.remove('show'));
}

window.API_URL = API_URL;
window.getCart = getCart;
window.saveCart = saveCart;
window.currentUser = currentUser;
window.setCurrentUser = setCurrentUser;
window.money = money;
window.escapeHtml = escapeHtml;
window.showToast = showToast;
window.updateCartBadge = updateCartBadge;
window.initNav = initNav;
window.addCartItem = addCartItem;
window.changeQty = changeQty;
window.cartDetailed = cartDetailed;
window.subtotal = subtotal;
window.getDeliveryCharge = getDeliveryCharge;
window.total = total;
window.apiRequest = apiRequest;
window.openFoodModal = openFoodModal;
window.closeModal = closeModal;

document.addEventListener('DOMContentLoaded', () => {
  initNav();

  document.querySelectorAll('[data-close-modal]').forEach((button) => {
    button.addEventListener('click', closeModal);
  });

  document.querySelectorAll('.modal').forEach((modal) => {
    modal.addEventListener('click', (event) => {
      if (event.target === modal) closeModal();
    });
  });
});
