require('dotenv').config();
const { db, initDb } = require('./db');
const { hashPassword } = require('./auth');

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'local-development-secret';
}

initDb();

const seedUser = db.transaction(() => {
  const userCount = db.prepare('SELECT COUNT(*) AS count FROM users').get().count;
  if (userCount === 0) {
    const insertUser = db.prepare(`
      INSERT INTO users (name, email, password_hash, role)
      VALUES (?, ?, ?, ?)
    `);
    insertUser.run('Hotel Admin', 'admin@hotel.com', hashPassword('admin123'), 'admin');
    insertUser.run('Demo Customer', 'customer@hotel.com', hashPassword('123456'), 'customer');
  }

  const itemCount = db.prepare('SELECT COUNT(*) AS count FROM menu_items').get().count;
  if (itemCount === 0) {
    const insertItem = db.prepare(`
      INSERT INTO menu_items (name, category, description, price, image, available)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

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

    for (const item of items) insertItem.run(...item);
  }
});

seedUser();
console.log('Database seeded successfully.');
console.log('Admin: admin@hotel.com / admin123');
console.log('Customer: customer@hotel.com / 123456');
