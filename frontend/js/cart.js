function renderCart() {
  const target = document.getElementById('cart-items');
  const summary = document.getElementById('cart-summary');
  if (!target) return;

  const items = cartDetailed();

  if (!items.length) {
    target.innerHTML = `
      <div class="empty">
        <div class="emoji">🛒</div>
        <h3>Your cart is empty</h3>
        <p>Add delicious items from the menu to get started.</p>
        <a class="btn btn-primary" href="menu.html" style="margin-top:15px">Browse Menu</a>
      </div>
    `;
    if (summary) summary.style.display = 'none';
    return;
  }

  target.innerHTML = items.map((item) => `
    <article class="cart-item">
      <div class="cart-thumb">
        ${item.image
          ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.classList.add('visible')"><span class="cart-image-fallback">🍽️</span>`
          : '<span class="cart-image-fallback visible">🍽️</span>'}
      </div>

      <div class="cart-info">
        <strong>${escapeHtml(item.name)}</strong>
        <div class="cart-category">${escapeHtml(item.category || '')}</div>
        <div class="cart-unit-price">${money(item.price)} each</div>
        <div class="qty" style="margin-top:9px">
          <button type="button" aria-label="Decrease quantity" data-minus="${item.id}">−</button>
          <b>${item.qty}</b>
          <button type="button" aria-label="Increase quantity" data-plus="${item.id}">+</button>
        </div>
      </div>

      <div class="cart-item-total">
        <strong>${money(item.price * item.qty)}</strong>
        <button type="button" class="btn btn-danger btn-sm" data-remove="${item.id}" style="margin-top:8px">Remove</button>
      </div>
    </article>
  `).join('');

  if (summary) {
    summary.style.display = 'block';
    document.getElementById('subtotal').textContent = money(subtotal());
    document.getElementById('delivery').textContent = getDeliveryCharge() ? money(getDeliveryCharge()) : 'FREE';
    document.getElementById('total').textContent = money(total());
  }

  target.querySelectorAll('[data-plus]').forEach((button) => {
    button.addEventListener('click', () => changeQty(button.dataset.plus, 1));
  });

  target.querySelectorAll('[data-minus]').forEach((button) => {
    button.addEventListener('click', () => changeQty(button.dataset.minus, -1));
  });

  target.querySelectorAll('[data-remove]').forEach((button) => {
    button.addEventListener('click', () => {
      const cart = getCart().filter((item) => Number(item.id) !== Number(button.dataset.remove));
      saveCart(cart);
      renderCart();
    });
  });
}

window.renderCart = renderCart;
document.addEventListener('DOMContentLoaded', renderCart);
