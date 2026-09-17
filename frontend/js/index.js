document.addEventListener('DOMContentLoaded', async () => {
  document.querySelectorAll('[data-category-link]').forEach((link) => {
    link.addEventListener('click', () => {
      localStorage.setItem('hotel_category', link.dataset.categoryLink);
    });
  });

  const grid = document.getElementById('popular-grid');
  if (!grid) return;

  try {
    const response = await fetch(`${window.API_URL || '/api'}/menu`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Could not load featured menu');

    const items = (data.items || []).slice(0, 8);

    if (!items.length) {
      grid.innerHTML = '<div class="empty" style="grid-column:1/-1">No food items available right now.</div>';
      return;
    }

    grid.innerHTML = items.map((item) => `
      <article class="food-card">
        <div class="food-image">
          ${item.image
            ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.classList.add('visible')"><div class="food-image-placeholder fallback-placeholder">🍽️</div>`
            : '<div class="food-image-placeholder">🍽️</div>'}
        </div>
        <div class="food-body">
          <div class="food-top">
            <div class="food-heading">
              <h3 class="food-title">${escapeHtml(item.name)}</h3>
              <span class="food-category">${escapeHtml(item.category)}</span>
            </div>
            <div class="price">${money(item.price)}</div>
          </div>
          <p class="food-desc">${escapeHtml(item.description || 'Freshly prepared and served with care.')}</p>
          <div class="food-meta">
            <span class="tag">${escapeHtml(item.category)}</span>
            <button type="button" class="btn btn-primary btn-sm" data-featured-add="${item.id}">Add</button>
          </div>
        </div>
      </article>
    `).join('');

    grid.querySelectorAll('[data-featured-add]').forEach((button) => {
      button.addEventListener('click', () => {
        const item = items.find((entry) => Number(entry.id) === Number(button.dataset.featuredAdd));
        addCartItem(item);
      });
    });
  } catch (error) {
    console.error(error);
    grid.innerHTML = `
      <div class="empty" style="grid-column:1/-1">
        <div class="emoji">⚠️</div>
        <h3>Featured menu unavailable</h3>
        <p>${escapeHtml(error.message)}</p>
      </div>
    `;
  }
});
