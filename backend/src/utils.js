function normalizeUser(user) {
  if (!user) return null;

  const syntheticPhoneEmail = String(user.email || '').endsWith('@phone.local');

  return {
    id: user.id,
    name: user.name,
    email: syntheticPhoneEmail ? null : user.email,
    phone: user.phone || null,
    gender: user.gender || null,
    authProvider: user.auth_provider || 'password',
    role: user.role,
    createdAt: user.created_at,
  };
}

function normalizeMenu(item) {
  return {
    id: item.id,
    name: item.name,
    category: item.category,
    description: item.description,
    price: Number(item.price),
    image: item.image,
    available: Boolean(item.available),
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  };
}

function normalizeReview(review) {
  if (!review) return null;
  return {
    id: review.id,
    orderId: review.order_id,
    userId: review.user_id,
    rating: Number(review.rating),
    comment: review.comment,
    createdAt: review.created_at,
    updatedAt: review.updated_at,
  };
}

function normalizeNotification(notification) {
  return {
    id: notification.id,
    orderId: notification.order_id,
    type: notification.type,
    status: notification.status,
    title: notification.title,
    message: notification.message,
    isRead: Boolean(notification.is_read),
    createdAt: notification.created_at,
  };
}

function normalizeOrder(order, items = [], review = null) {
  return {
    id: order.id,
    userId: order.user_id,
    customer: {
      name: order.customer_name,
      phone: order.customer_phone,
      address: order.delivery_address,
    },
    total: Number(order.total),
    status: order.status,
    notes: order.notes,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
    items: items.map((item) => ({
      id: item.id,
      menuItemId: item.menu_item_id,
      name: item.item_name,
      price: Number(item.price),
      quantity: item.quantity,
      subtotal: Number(item.subtotal),
    })),
    review: normalizeReview(review),
  };
}

module.exports = {
  normalizeUser,
  normalizeMenu,
  normalizeOrder,
  normalizeReview,
  normalizeNotification,
};
