const ADMIN_API_URL = window.location.port === '5500' ? 'http://localhost:8000/api' : '/api';
let adminOrdersData = [];

async function authFetch(path, options = {}) {
  const token = localStorage.getItem('hotel_token');
  const headers = { ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';

  const response = await fetch(`${ADMIN_API_URL}${path}`, { ...options, headers });
  let data = {};
  try { data = await response.json(); } catch (_) {}
  if (!response.ok) throw new Error(data.message || `Request failed (${response.status})`);
  return data;
}

async function loadStats() {
  const data = await authFetch('/admin/stats');
  const stats = data.stats || {};

  const map = {
    'stat-orders': stats.orders ?? 0,
    'stat-revenue': money(stats.revenue ?? 0),
    'stat-menu': stats.menuItems ?? 0,
    'stat-users': stats.customers ?? 0,
    'stat-pending': stats.pending ?? 0,
    'stat-delivered': stats.completed ?? 0,
    'stat-cancelled': stats.cancelled ?? 0,
    'stat-rating': `${Number(stats.averageRating || 0).toFixed(1)} ★`,
  };

  Object.entries(map).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  });
}

async function loadOrders() {
  const data = await authFetch('/admin/orders');
  adminOrdersData = data.orders || [];
  return adminOrdersData;
}

function renderOrders(orders) {
  const body = document.getElementById('orders-table');
  if (!body) return;

  if (!orders.length) {
    body.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px">No orders found.</td></tr>';
    return;
  }

  body.innerHTML = orders.map((order) => `
    <tr>
      <td><strong>#${order.id}</strong></td>
      <td>${escapeHtml(order.customer?.name || 'Customer')}</td>
      <td>${new Date(order.createdAt).toLocaleDateString()}</td>
      <td>${money(order.total)}</td>
      <td>
        <select class="form-control status-select" data-id="${order.id}">
          <option value="Pending" ${order.status === 'Pending' ? 'selected' : ''}>Pending</option>
          <option value="Preparing" ${order.status === 'Preparing' ? 'selected' : ''}>Preparing</option>
          <option value="Ready" ${order.status === 'Ready' ? 'selected' : ''}>Ready</option>
          <option value="Completed" ${order.status === 'Completed' ? 'selected' : ''}>Delivered</option>
          <option value="Cancelled" ${order.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
        </select>
      </td>
      <td><button type="button" class="btn btn-secondary btn-sm" data-view-order="${order.id}">View</button></td>
    </tr>
  `).join('');

  body.querySelectorAll('.status-select').forEach((select) => {
    select.addEventListener('change', async () => {
      const previousValue = select.dataset.previous || select.value;
      select.dataset.previous = select.value;

      try {
        await authFetch(`/admin/orders/${select.dataset.id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status: select.value }),
        });
        showToast('Order status updated.');
        await renderAdmin();
      } catch (error) {
        select.value = previousValue;
        showToast(error.message, 'error');
      }
    });
  });

  body.querySelectorAll('[data-view-order]').forEach((button) => {
    button.addEventListener('click', () => {
      const order = adminOrdersData.find((item) => Number(item.id) === Number(button.dataset.viewOrder));
      if (!order) return;

      const items = (order.items || []).map((item) => `${item.name} × ${item.quantity}`).join('\n');
      alert(
        `Order #${order.id}\n\n` +
        `Customer: ${order.customer?.name || ''}\n` +
        `Phone: ${order.customer?.phone || ''}\n` +
        `Address: ${order.customer?.address || ''}\n` +
        `Status: ${order.status}\n` +
        `Total: ${money(order.total)}\n\n` +
        `Items:\n${items}`
      );
    });
  });
}

async function renderReviews() {
  const box = document.getElementById('reviews-list');
  if (!box) return;

  try {
    const data = await authFetch('/admin/reviews');
    const reviews = data.reviews || [];

    box.innerHTML = reviews.length
      ? reviews.map((review) => `
          <div class="admin-review">
            <div class="admin-review-head">
              <strong>${escapeHtml(review.customerName || 'Customer')}</strong>
              <span>${'★'.repeat(Number(review.rating))}${'☆'.repeat(5 - Number(review.rating))}</span>
            </div>
            <p>${escapeHtml(review.comment || 'No written comment.')}</p>
            <small>Order #${review.orderId} · ${new Date(review.createdAt).toLocaleString()}</small>
          </div>
        `).join('')
      : '<div class="empty small-empty">No reviews yet.</div>';
  } catch (error) {
    box.innerHTML = `<div class="empty small-empty">${escapeHtml(error.message)}</div>`;
  }
}

async function renderAdmin() {
  await loadStats();
  const orders = await loadOrders();
  renderOrders(orders);
  await renderReviews();
}

window.renderAdmin = renderAdmin;

document.addEventListener('DOMContentLoaded', async () => {
  const user = currentUser();
  if (!user || user.role !== 'admin') {
    window.location.href = 'login.html';
    return;
  }

  try {
    await renderAdmin();
  } catch (error) {
    console.error(error);
    showToast(error.message || 'Could not load the admin dashboard.', 'error');
  }

  document.getElementById('logout-admin')?.addEventListener('click', () => {
    localStorage.removeItem('hotel_token');
    setCurrentUser(null);
    window.location.href = 'index.html';
  });
});
