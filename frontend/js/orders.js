// API endpoint is resolved for local development, GitHub Pages, and Render.
const ORDERS_API_URL = resolveApiUrl();

function displayStatus(status) {
  return status === 'Completed' ? 'Delivered' : status;
}

async function apiGet(path) {
  const token = localStorage.getItem('hotel_token');
  const response = await fetch(`${ORDERS_API_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Request failed');
  return data;
}

async function loadNotifications() {
  const panel = document.getElementById('notifications-panel');
  const count = document.getElementById('notification-count');
  if (!panel) return;

  try {
    const data = await apiGet('/notifications');
    if (count) count.textContent = data.unreadCount;

    const notifications = data.notifications || [];

    panel.innerHTML = notifications.length
      ? notifications.map((item) => `
          <div class="notification-item ${item.isRead ? '' : 'unread'}" data-notification="${item.id}">
            <div class="notification-icon">
              ${item.status === 'Completed' ? '✅' : item.status === 'Cancelled' ? '❌' : '🔔'}
            </div>
            <div class="notification-content">
              <strong>${escapeHtml(item.title)}</strong>
              <p>${escapeHtml(item.message)}</p>
              <small>${new Date(item.createdAt).toLocaleString()}</small>
            </div>
            ${item.isRead ? '' : '<span class="unread-dot"></span>'}
          </div>
        `).join('')
      : '<div class="empty small-empty">No notifications yet.</div>';

    panel.querySelectorAll('[data-notification]').forEach((element) => {
      element.addEventListener('click', async () => {
        if (!element.classList.contains('unread')) return;

        try {
          await fetch(`${ORDERS_API_URL}/notifications/${element.dataset.notification}/read`, {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${localStorage.getItem('hotel_token')}` },
          });
          await loadNotifications();
        } catch (error) {
          console.error(error);
        }
      });
    });
  } catch (error) {
    console.error(error);
    panel.innerHTML = `<div class="empty small-empty">${escapeHtml(error.message)}</div>`;
  }
}

function stars(rating) {
  const value = Number(rating || 0);
  return '★★★★★'.split('').map((star, index) =>
    `<span class="star ${index < value ? 'filled' : ''}">${star}</span>`
  ).join('');
}

function reviewHtml(order) {
  if (order.status !== 'Completed') return '';

  if (order.review) {
    return `
      <div class="review-box submitted-review">
        <div class="review-title">Your review</div>
        <div class="stars-display">${stars(order.review.rating)}</div>
        <p>${escapeHtml(order.review.comment || 'No written comment.')}</p>
        <small>Updated ${new Date(order.review.updatedAt).toLocaleString()}</small>
      </div>
    `;
  }

  return `
    <div class="review-box" data-review-box="${order.id}">
      <div class="review-title">How was your delivered order?</div>
      <div class="review-stars" data-rating-for="${order.id}">
        ${[1, 2, 3, 4, 5].map((number) => `
          <button type="button" class="star-button" data-rating="${number}" aria-label="${number} star">★</button>
        `).join('')}
      </div>
      <textarea class="form-control review-comment" data-comment-for="${order.id}" maxlength="500" rows="3" placeholder="Tell us about the food and service..."></textarea>
      <button class="btn btn-primary btn-sm submit-review" data-submit-review="${order.id}">Submit Review</button>
    </div>
  `;
}

async function loadOrders() {
  const target = document.getElementById('orders-list');
  if (!target) return;

  try {
    const data = await apiGet('/orders/my');
    const orders = data.orders || [];

    if (!orders.length) {
      target.innerHTML = `
        <div class="empty">
          <div class="emoji">🍽️</div>
          <h3>No orders yet</h3>
          <a class="btn btn-primary" href="menu.html" style="margin-top:15px">Order Food</a>
        </div>
      `;
      return;
    }

    const latestDelivered = orders.find((order) => order.status === 'Completed');
    const deliveredBanner = latestDelivered ? `
      <div class="delivery-banner">
        <div class="delivery-icon">✅</div>
        <div>
          <strong>Order #${latestDelivered.id} delivered</strong>
          <p>Your order has been delivered. Thank you for ordering from HotelEase. You can now leave a review.</p>
        </div>
      </div>
    ` : '';

    target.innerHTML = deliveredBanner + orders.map((order) => `
      <article class="order-card">
        <div class="order-head">
          <div>
            <strong>Order #${order.id}</strong>
            <div class="order-date">${new Date(order.createdAt).toLocaleString()}</div>
          </div>
          <span class="status ${order.status}">${displayStatus(order.status)}</span>
        </div>

        <div class="order-items">
          ${order.items.map((item) => `${escapeHtml(item.name)} × ${item.quantity}`).join(' • ')}
        </div>

        <div class="order-summary-line">
          <strong>Total: ${money(order.total)}</strong>
          <span>${escapeHtml(order.customer.address)}</span>
        </div>

        ${reviewHtml(order)}
      </article>
    `).join('');

    document.querySelectorAll('.review-stars').forEach((group) => {
      group.dataset.selected = '0';
      group.querySelectorAll('.star-button').forEach((button) => {
        button.addEventListener('click', () => {
          const value = Number(button.dataset.rating);
          group.dataset.selected = String(value);
          group.querySelectorAll('.star-button').forEach((starButton) => {
            starButton.classList.toggle('selected', Number(starButton.dataset.rating) <= value);
          });
        });
      });
    });

    document.querySelectorAll('[data-submit-review]').forEach((button) => {
      button.addEventListener('click', async () => {
        const orderId = button.dataset.submitReview;
        const group = document.querySelector(`[data-rating-for="${orderId}"]`);
        const comment = document.querySelector(`[data-comment-for="${orderId}"]`);
        const rating = Number(group?.dataset.selected || 0);

        if (!rating) {
          showToast('Please choose a rating first.', 'error');
          return;
        }

        button.disabled = true;
        try {
          const response = await fetch(`${ORDERS_API_URL}/orders/${orderId}/review`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${localStorage.getItem('hotel_token')}`,
            },
            body: JSON.stringify({
              rating,
              comment: comment?.value || '',
            }),
          });

          const result = await response.json();
          if (!response.ok) throw new Error(result.message || 'Could not save review');

          showToast('Thank you for your review!');
          await loadOrders();
        } catch (error) {
          button.disabled = false;
          showToast(error.message || 'Could not save review', 'error');
        }
      });
    });
  } catch (error) {
    console.error(error);
    target.innerHTML = `
      <div class="empty">
        <div class="emoji">⚠️</div>
        <h3>Unable to load orders</h3>
        <p>${escapeHtml(error.message)}</p>
      </div>
    `;
  }
}

window.loadOrders = loadOrders;
window.loadNotifications = loadNotifications;

document.addEventListener('DOMContentLoaded', async () => {
  const user = currentUser();

  if (!user) {
    document.getElementById('orders-list').innerHTML = `
      <div class="empty">
        <div class="emoji">🔐</div>
        <h3>Login to see your orders</h3>
        <a class="btn btn-primary" href="login.html" style="margin-top:15px">Login</a>
      </div>
    `;
    return;
  }

  document.getElementById('mark-all-read')?.addEventListener('click', async () => {
    try {
      await fetch(`${ORDERS_API_URL}/notifications/read-all`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${localStorage.getItem('hotel_token')}` },
      });
      await loadNotifications();
    } catch (error) {
      showToast(error.message || 'Could not update notifications', 'error');
    }
  });

  await loadNotifications();
  await loadOrders();
});
