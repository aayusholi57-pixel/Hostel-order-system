// API endpoint is resolved for local development, GitHub Pages, and Render.
const CHECKOUT_API_URL = resolveApiUrl();

function renderCheckout() {
  const target = document.getElementById('checkout-items');
  if (!target) return;

  const items = cartDetailed();

  target.innerHTML = items.length
    ? items.map((item) => `
        <div class="summary-row">
          <span>${escapeHtml(item.name)} × ${item.qty}</span>
          <strong>${money(item.price * item.qty)}</strong>
        </div>
      `).join('')
    : '<p style="color:#777">Your cart is empty.</p>';

  document.getElementById('checkout-subtotal').textContent = money(subtotal());
  document.getElementById('checkout-delivery').textContent = getDeliveryCharge() ? money(getDeliveryCharge()) : 'FREE';
  document.getElementById('checkout-total').textContent = money(total());
}

window.renderCheckout = renderCheckout;

document.addEventListener('DOMContentLoaded', () => {
  renderCheckout();

  const token = localStorage.getItem('hotel_token');
  const user = currentUser();

  if (!token || !user) {
    showToast('Please login before placing an order.', 'error');
    setTimeout(() => { window.location.href = 'login.html'; }, 700);
    return;
  }

  const nameField = document.querySelector('[name="name"]');
  const emailField = document.querySelector('[name="email"]');
  const phoneField = document.querySelector('[name="phone"]');

  if (nameField) nameField.value = user.name || '';
  if (emailField) {
    emailField.value = user.email || '';
    emailField.readOnly = Boolean(user.email);
  }
  if (phoneField) phoneField.value = user.phone || '';

  const form = document.getElementById('checkout-form');

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const items = cartDetailed();
    if (!items.length) {
      showToast('Your cart is empty.', 'error');
      return;
    }

    const formData = new FormData(form);
    const name = String(formData.get('name') || '').trim();
    const phone = String(formData.get('phone') || '').trim();
    const address = String(formData.get('address') || '').trim();
    const payment = String(formData.get('payment') || 'Cash on Delivery');

    if (!name || !phone || !address) {
      showToast('Please fill in name, phone and delivery address.', 'error');
      return;
    }

    const payload = {
      items: items.map((item) => ({
        menuItemId: Number(item.id),
        quantity: Number(item.qty),
      })),
      customer: { name, phone, address },
      notes: `Payment method: ${payment}`,
    };

    const button = form.querySelector('button[type="submit"]');
    if (button) {
      button.disabled = true;
      button.textContent = 'Placing Order...';
    }

    try {
      const response = await fetch(`${CHECKOUT_API_URL}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not create order');

      saveCart([]);
      localStorage.setItem('hotel_last_order', JSON.stringify(data.order));
      showToast('Order placed successfully!');

      setTimeout(() => {
        window.location.href = `success.html?order=${encodeURIComponent(data.order.id)}`;
      }, 600);
    } catch (error) {
      console.error(error);
      showToast(error.message || 'Could not create order.', 'error');
      if (button) {
        button.disabled = false;
        button.textContent = 'Place Order';
      }
    }
  });
});
