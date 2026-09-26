require('dotenv').config();
const { db, initDb } = require('./db');
const { hashPassword } = require('./auth');

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'local-development-secret';
}

initDb();

const isProduction = process.env.NODE_ENV === 'production';

function seedAdmin() {
  const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = String(process.env.ADMIN_PASSWORD || '');

  if (isProduction && (!email || !password)) {
    console.log('Production admin seed skipped: set ADMIN_EMAIL and ADMIN_PASSWORD to bootstrap an admin account.');
    return;
  }

  const adminEmail = email || 'admin@hotel.com';
  const adminPassword = password || 'admin123';
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail);

  if (!existing) {
    db.prepare('INSERT INTO users (name, email, password_hash, role, auth_provider) VALUES (?, ?, ?, \'admin\', \'password\')').run(
      'Hotel Admin', adminEmail, hashPassword(adminPassword)
    );
  }
}

function seedDemoCustomer() {
  if (isProduction) return;
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get('customer@hotel.com');
  if (!existing) {
    db.prepare('INSERT INTO users (name, email, password_hash, role, auth_provider) VALUES (?, ?, ?, \'customer\', \'password\')').run(
      'Demo Customer', 'customer@hotel.com', hashPassword('123456')
    );
  }
}

function seedMenu() {
  const itemCount = db.prepare('SELECT COUNT(*) AS count FROM menu_items').get().count;
  if (itemCount > 0) return;
  const insertItem = db.prepare('INSERT INTO menu_items (name, category, description, price, image, available) VALUES (?, ?, ?, ?, ?, ?)');
  const items = [
    ['Chicken Momo', 'Momo', 'Steamed chicken dumplings served with a spicy house chutney.', 180, 'https://images.unsplash.com/photo-1626804475297-41608ea09aeb?auto=format&fit=crop&w=900&q=80', 1],
    ['Veg Momo', 'Momo', 'Steamed vegetable dumplings with fresh herbs and house chutney.', 150, 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=900&q=80', 1],
    ['Chicken Chowmein', 'Noodles', 'Wok-tossed noodles with chicken, vegetables and signature sauce.', 220, 'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=900&q=80', 1],
    ['Veg Chowmein', 'Noodles', 'Classic wok-fried noodles with seasonal vegetables.', 180, 'https://images.unsplash.com/photo-1552611052-33e04de081de?auto=format&fit=crop&w=900&q=80', 1],
    ['Chicken Pizza', 'Pizza', 'Hand-stretched pizza topped with chicken, mozzarella and herbs.', 450, 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=900&q=80', 1],
    ['Margherita Pizza', 'Pizza', 'Classic tomato, mozzarella and basil pizza.', 400, 'https://images.unsplash.com/photo-1579751626657-72bc17010498?auto=format&fit=crop&w=900&q=80', 1],
    ['Club Sandwich', 'Snacks', 'Triple-layer sandwich with chicken, vegetables and fries.', 280, 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=900&q=80', 1],
    ['French Fries', 'Snacks', 'Crispy golden fries served with ketchup and dip.', 140, 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=900&q=80', 1],
    ['Cappuccino', 'Drinks', 'Espresso balanced with steamed milk and a smooth foam layer.', 150, 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=900&q=80', 1],
    ['Fresh Lemonade', 'Drinks', 'Refreshing lemon drink with mint and ice.', 120, 'https://images.unsplash.com/photo-1523677011781-c91d1bbe2f2e?auto=format&fit=crop&w=900&q=80', 1]
  ];
  const transaction = db.transaction(() => {
    for (const item of items) insertItem.run(...item);
  });
  transaction();
}

seedAdmin();
seedDemoCustomer();
seedMenu();

console.log('Database seed completed.');