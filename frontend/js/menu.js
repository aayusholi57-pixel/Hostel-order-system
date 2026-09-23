// API endpoint is resolved for local development, GitHub Pages, and Render.
const MENU_API_URL = resolveApiUrl();

document.addEventListener('DOMContentLoaded', async () => {
  const filters = document.getElementById('filters');
  const search = document.getElementById('menu-search');
  const grid = document.getElementById('menu-grid');

  if (!filters || !search || !grid) return;

  let activeCategory = localStorage.getItem('hotel_category') || 'All';
  localStorage.removeItem('hotel_category');
  let allItems = [];

  function renderFilters(items) {
    const categories = ['All', ...new Set(items.map((item) => item.category).filter(Boolean))];

    if (activeCategory !== 'All' && !categories.includes(activeCategory)) {
      activeCategory = 'All';
    }

    filters.innerHTML = categories.map((category) => `
      <button
        type="button"
        class="filter-btn ${category === activeCategory ? 'active' : ''}"
        data-category="${escapeHtml(category)}"
      >
        ${escapeHtml(category)}
      </button>
    `).join('');
  }

  function imageMarkup(item) {
    if (!item.image) {
      return '<div class="food-image-placeholder">🍽️</div>';
    }

    return `
      <img
        src="${escapeHtml(item.image)}"
        alt="${escapeHtml(item.name)}"
        loading="lazy"
        onerror="this.style.display='none';this.nextElementSibling.classList.add('visible')"
      >
      <div class="food-image-placeholder fallback-placeholder">🍽️</div>
    `;
  }

  function render(items) {
    if (!items.length) {
      grid.innerHTML = `
        <div class="empty menu-empty" style="grid-column:1/-1">
          <div class="emoji">🍽️</div>
          <h3>No food found</h3>
          <p>Try another category or search term.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = items.map((item) => `
      <article class="food-card">
        <div class="food-image">
          ${imageMarkup(item)}
        </div>

        <div class="food-body">
          <div class="food-top">
            <div class="food-heading">
              <h3 class="food-title">${escapeHtml(item.name)}</h3>
              <span class="food-category">${escapeHtml(item.category)}</span>
            </div>
            <div class="price">${money(item.price)}</div>
          </div>

          <p class="food-desc">
            ${escapeHtml(item.description || 'Freshly prepared and served with care.')}
          </p>

          <div class="food-meta">
            <span class="tag">${escapeHtml(item.category)}</span>
            <div class="food-actions">
              <button type="button" class="btn btn-secondary btn-sm" data-view="${item.id}">View</button>
              <button type="button" class="btn btn-primary btn-sm" data-add="${item.id}">Add</button>
            </div>
          </div>
        </div>
      </article>
    `).join('');

    grid.querySelectorAll('[data-add]').forEach((button) => {
      button.addEventListener('click', () => {
        const item = allItems.find((entry) => Number(entry.id) === Number(button.dataset.add));
        addCartItem(item);
      });
    });

    grid.querySelectorAll('[data-view]').forEach((button) => {
      button.addEventListener('click', () => {
        const item = allItems.find((entry) => Number(entry.id) === Number(button.dataset.view));
        openFoodModal(item);
      });
    });
  }

  function applyFilters() {
    const term = search.value.trim().toLowerCase();
    const filtered = allItems.filter((item) => {
      const matchesCategory = activeCategory === 'All' || item.category === activeCategory;
      const haystack = `${item.name} ${item.category} ${item.description}`.toLowerCase();
      return matchesCategory && (!term || haystack.includes(term));
    });

    render(filtered);
    filters.querySelectorAll('.filter-btn').forEach((button) => {
      button.classList.toggle('active', button.dataset.category === activeCategory);
    });
  }

  async function loadMenu() {
    try {
      grid.innerHTML = `
        <div class="loading-grid" style="grid-column:1/-1">
          <div class="loading-card"></div>
          <div class="loading-card"></div>
          <div class="loading-card"></div>
          <div class="loading-card"></div>
        </div>
      `;

      const response = await fetch(`${MENU_API_URL}/menu`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Could not load the menu.');
      }

      allItems = Array.isArray(data.items) ? data.items : [];
      renderFilters(allItems);
      applyFilters();
    } catch (error) {
      console.error('Menu loading error:', error);
      grid.innerHTML = `
        <div class="empty menu-empty" style="grid-column:1/-1">
          <div class="emoji">⚠️</div>
          <h3>Menu could not be loaded</h3>
          <p>${escapeHtml(error.message)}</p>
          <button class="btn btn-primary" id="retry-menu" style="margin-top:14px">Retry</button>
        </div>
      `;
      document.getElementById('retry-menu')?.addEventListener('click', loadMenu);
    }
  }

  filters.addEventListener('click', (event) => {
    const button = event.target.closest('[data-category]');
    if (!button) return;
    activeCategory = button.dataset.category;
    applyFilters();
  });

  search.addEventListener('input', applyFilters);

  await loadMenu();
});
