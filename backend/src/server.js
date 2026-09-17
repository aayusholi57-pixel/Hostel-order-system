require('dotenv').config();

const crypto = require('crypto');
const path = require('path');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const { db, initDb } = require('./db');

const {
  hashPassword,
  verifyPassword,
  createToken,
  requireAuth,
  requireAdmin,
} = require('./auth');

const { verifyFirebaseIdToken } = require('./firebase');

const {
  normalizeUser,
  normalizeMenu,
  normalizeOrder,
  normalizeReview,
  normalizeNotification,
} = require('./utils');


// ============================================================
// DATABASE
// ============================================================

initDb();


// ============================================================
// JWT
// ============================================================

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET =
    'local-development-secret-change-me';
}


// ============================================================
// EXPRESS
// ============================================================

const app = express();

const PORT =
  Number(process.env.PORT || 8000);


// ============================================================
// MIDDLEWARE
// ============================================================

// Allow local frontend / Live Server requests.
app.use(cors());

app.use(
  express.json({
    limit: '1mb',
  })
);

app.use(morgan('dev'));


// ============================================================
// FRONTEND LOCATION
// ============================================================

// server.js:
// E:\hotelorder-system\backend\src\server.js
//
// Frontend:
// E:\hotelorder-system\frontend
//
// Therefore:
// src -> backend -> hotelorder-system -> frontend

const frontendDir = path.join(
  __dirname,
  '..',
  '..',
  'frontend'
);

console.log(
  'Frontend directory:',
  frontendDir
);


// Serve frontend files.
app.use(
  express.static(frontendDir)
);


// ============================================================
// HELPERS
// ============================================================

function getReviewForOrder(orderId) {
  return (
    db
      .prepare(
        'SELECT * FROM reviews WHERE order_id = ?'
      )
      .get(orderId) || null
  );
}


function getOrderPayload(order) {

  const items = db
    .prepare(
      `
      SELECT *
      FROM order_items
      WHERE order_id = ?
      ORDER BY id
      `
    )
    .all(order.id);

  return normalizeOrder(
    order,
    items,
    getReviewForOrder(order.id)
  );
}


function createStatusNotification(
  userId,
  orderId,
  status
) {

  const latest = db
    .prepare(
      `
      SELECT status
      FROM notifications
      WHERE user_id = ?
        AND order_id = ?
        AND type = 'ORDER_STATUS'
      ORDER BY id DESC
      LIMIT 1
      `
    )
    .get(
      userId,
      orderId
    );

  if (
    latest &&
    latest.status === status
  ) {
    return;
  }


  const messages = {

    Pending: {
      title:
        `Order #${orderId} received`,
      message:
        `We received your order #${orderId}. The hotel will start preparing it shortly.`,
    },

    Preparing: {
      title:
        `Order #${orderId} is being prepared`,
      message:
        `The kitchen is preparing your order #${orderId}.`,
    },

    Ready: {
      title:
        `Order #${orderId} is ready`,
      message:
        `Your order #${orderId} is ready for delivery or collection.`,
    },

    Completed: {
      title:
        `Order #${orderId} delivered`,
      message:
        `Your order #${orderId} has been marked as delivered. Enjoy your meal! You can now leave a review.`,
    },

    Cancelled: {
      title:
        `Order #${orderId} cancelled`,
      message:
        `Your order #${orderId} has been cancelled. Please contact the hotel if you need help.`,
    },
  };


  const copy =
    messages[status] ||
    messages.Pending;


  db.prepare(
    `
    INSERT INTO notifications
    (
      user_id,
      order_id,
      type,
      status,
      title,
      message,
      is_read
    )
    VALUES
    (
      ?,
      ?,
      'ORDER_STATUS',
      ?,
      ?,
      ?,
      0
    )
    `
  ).run(
    userId,
    orderId,
    status,
    copy.title,
    copy.message
  );
}


function ensureFirebaseConfigured(res) {

  const configured =
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY;

  if (!configured) {

    res.status(503).json({
      message:
        'Firebase login is not configured on the backend. Add FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY to .env.',
    });

    return false;
  }

  return true;
}


// ============================================================
// HEALTH
// ============================================================

app.get(
  '/api/health',
  (req, res) => {

    res.json({
      status: 'ok',
      service: 'hotel-order-backend',
      time: new Date().toISOString(),
    });

  }
);


// ============================================================
// AUTH - REGISTER
// ============================================================

app.post(
  '/api/auth/register',
  (req, res) => {

    try {

      const name =
        String(
          req.body.name || ''
        ).trim();

      const email =
        String(
          req.body.email || ''
        )
          .trim()
          .toLowerCase();

      const password =
        String(
          req.body.password || ''
        );


      if (
        !name ||
        !email ||
        password.length < 6
      ) {

        return res.status(400).json({
          message:
            'Name, valid email, and password of at least 6 characters are required',
        });

      }


      const exists =
        db
          .prepare(
            'SELECT id FROM users WHERE email = ?'
          )
          .get(email);


      if (exists) {

        return res.status(409).json({
          message:
            'An account with this email already exists',
        });

      }


      const result =
        db
          .prepare(
            `
            INSERT INTO users
            (
              name,
              email,
              password_hash,
              role,
              auth_provider
            )
            VALUES
            (
              ?,
              ?,
              ?,
              'customer',
              'password'
            )
            `
          )
          .run(
            name,
            email,
            hashPassword(password)
          );


      const user =
        db
          .prepare(
            'SELECT * FROM users WHERE id = ?'
          )
          .get(
            result.lastInsertRowid
          );


      const token =
        createToken(user);


      res.status(201).json({
        token,
        user: normalizeUser(user),
      });

    } catch (error) {

      console.error(error);

      res.status(500).json({
        message:
          'Registration failed',
      });
    }
  }
);


// ============================================================
// AUTH - LOGIN
// ============================================================

app.post(
  '/api/auth/login',
  (req, res) => {

    try {

      const email =
        String(
          req.body.email || ''
        )
          .trim()
          .toLowerCase();

      const password =
        String(
          req.body.password || ''
        );


      const user =
        db
          .prepare(
            'SELECT * FROM users WHERE email = ?'
          )
          .get(email);


      if (
        !user ||
        !verifyPassword(
          password,
          user.password_hash
        )
      ) {

        return res.status(401).json({
          message:
            'Invalid email or password',
        });

      }


      const token =
        createToken(user);


      res.json({
        token,
        user: normalizeUser(user),
      });

    } catch (error) {

      console.error(error);

      res.status(500).json({
        message:
          'Login failed',
      });
    }
  }
);


// ============================================================
// FIREBASE GOOGLE / PHONE LOGIN
// ============================================================

app.post(
  '/api/auth/firebase',
  async (req, res) => {

    try {

      if (
        !ensureFirebaseConfigured(res)
      ) {
        return;
      }


      const idToken =
        String(
          req.body.idToken || ''
        ).trim();

      const suppliedName =
        String(
          req.body.name || ''
        ).trim();


      if (!idToken) {

        return res.status(400).json({
          message:
            'Firebase ID token is required',
        });

      }


      const decoded =
        await verifyFirebaseIdToken(
          idToken
        );


      const firebaseUid =
        decoded.uid;

      const provider =
        decoded.firebase?.sign_in_provider ||
        'firebase';

      const email =
        decoded.email
          ? String(
              decoded.email
            )
              .trim()
              .toLowerCase()
          : null;

      const phone =
        decoded.phone_number ||
        null;

      const displayName =
        suppliedName ||
        decoded.name ||
        (
          phone
            ? 'Hotel Customer'
            : 'Google Customer'
        );


      let user =
        db
          .prepare(
            `
            SELECT *
            FROM users
            WHERE firebase_uid = ?
            `
          )
          .get(
            firebaseUid
          );


      if (!user && email) {

        user =
          db
            .prepare(
              `
              SELECT *
              FROM users
              WHERE email = ?
              `
            )
            .get(email);
      }


      if (!user && phone) {

        user =
          db
            .prepare(
              `
              SELECT *
              FROM users
              WHERE phone = ?
              `
            )
            .get(phone);
      }


      const authProvider =
        provider === 'google.com'
          ? 'google'
          : (
              provider === 'phone'
                ? 'phone'
                : 'firebase'
            );


      if (user) {

        db.prepare(
          `
          UPDATE users
          SET
            firebase_uid = ?,
            phone = COALESCE(?, phone),
            name = ?,
            auth_provider = ?,
            email =
              CASE
                WHEN ? IS NOT NULL
                THEN ?
                ELSE email
              END
          WHERE id = ?
          `
        ).run(
          firebaseUid,
          phone,
          displayName,
          authProvider,
          email,
          email,
          user.id
        );

      } else {

        const internalEmail =
          email ||
          `firebase_${firebaseUid}@phone.local`;

        const randomPassword =
          hashPassword(
            crypto
              .randomBytes(24)
              .toString('hex')
          );


        const result =
          db.prepare(
            `
            INSERT INTO users
            (
              name,
              email,
              password_hash,
              role,
              firebase_uid,
              phone,
              auth_provider
            )
            VALUES
            (
              ?,
              ?,
              ?,
              'customer',
              ?,
              ?,
              ?
            )
            `
          ).run(
            displayName,
            internalEmail,
            randomPassword,
            firebaseUid,
            phone,
            authProvider
          );


        user =
          db
            .prepare(
              `
              SELECT *
              FROM users
              WHERE id = ?
              `
            )
            .get(
              result.lastInsertRowid
            );
      }


      user =
        db
          .prepare(
            'SELECT * FROM users WHERE id = ?'
          )
          .get(user.id);


      const token =
        createToken(user);


      res.json({
        token,
        user: normalizeUser(user),
      });

    } catch (error) {

      console.error(
        'Firebase auth error:',
        error
      );

      res.status(401).json({
        message:
          'Firebase authentication failed',
      });
    }
  }
);


// ============================================================
// AUTH - CURRENT USER
// ============================================================

app.get(
  '/api/auth/me',
  requireAuth,
  (req, res) => {

    res.json({
      user: normalizeUser(req.user),
    });

  }
);


// ============================================================
// PUBLIC MENU
// ============================================================

app.get(
  '/api/menu',
  (req, res) => {

    const {
      category,
      search,
    } = req.query;


    let query =
      `
      SELECT *
      FROM menu_items
      WHERE available = 1
      `;

    const params = [];


    if (
      category &&
      category !== 'All'
    ) {

      query +=
        ' AND category = ?';

      params.push(
        category
      );
    }


    if (search) {

      query +=
        `
        AND
        (
          name LIKE ?
          OR description LIKE ?
        )
        `;

      const term =
        `%${String(
          search
        ).trim()}%`;

      params.push(
        term,
        term
      );
    }


    query +=
      `
      ORDER BY category, name
      `;


    const items =
      db
        .prepare(query)
        .all(...params)
        .map(normalizeMenu);


    res.json({
      items,
    });

  }
);


// ============================================================
// SINGLE MENU ITEM
// ============================================================

app.get(
  '/api/menu/:id',
  (req, res) => {

    const item =
      db
        .prepare(
          'SELECT * FROM menu_items WHERE id = ?'
        )
        .get(
          req.params.id
        );


    if (!item) {

      return res.status(404).json({
        message:
          'Menu item not found',
      });

    }


    res.json({
      item: normalizeMenu(item),
    });

  }
);


// ============================================================
// CREATE ORDER
// ============================================================

app.post(
  '/api/orders',
  requireAuth,
  (req, res) => {

    try {

      const {
        items,
        customer,
        notes,
      } = req.body;


      if (
        !Array.isArray(items) ||
        items.length === 0
      ) {

        return res.status(400).json({
          message:
            'At least one item is required',
        });

      }


      const customerName =
        String(
          customer?.name ||
          req.user.name
        ).trim();

      const customerPhone =
        String(
          customer?.phone ||
          req.user.phone ||
          ''
        ).trim();

      const address =
        String(
          customer?.address ||
          ''
        ).trim();

      const noteText =
        String(
          notes || ''
        ).trim();


      if (
        !customerPhone ||
        !address
      ) {

        return res.status(400).json({
          message:
            'Phone and delivery address are required',
        });

      }


      const normalizedItems =
        items.map(
          (item) => ({
            menuItemId:
              Number(
                item.menuItemId ||
                item.id
              ),

            quantity:
              Math.max(
                1,
                Number(
                  item.quantity || 1
                )
              ),
          })
        );


      const ids =
        [
          ...new Set(
            normalizedItems.map(
              (item) =>
                item.menuItemId
            )
          ),
        ];


      const placeholders =
        ids
          .map(() => '?')
          .join(',');


      const dbItems =
        db
          .prepare(
            `
            SELECT *
            FROM menu_items
            WHERE id IN (${placeholders})
            AND available = 1
            `
          )
          .all(
            ...ids
          );


      const itemMap =
        new Map(
          dbItems.map(
            (item) => [
              item.id,
              item,
            ]
          )
        );


      if (
        dbItems.length !==
        ids.length
      ) {

        return res.status(400).json({
          message:
            'One or more selected menu items are unavailable',
        });

      }


      let total = 0;


      const resolved =
        normalizedItems.map(
          (input) => {

            const item =
              itemMap.get(
                input.menuItemId
              );

            const subtotal =
              Number(item.price) *
              input.quantity;


            total +=
              subtotal;


            return {
              menuItemId:
                item.id,

              itemName:
                item.name,

              price:
                Number(item.price),

              quantity:
                input.quantity,

              subtotal,
            };
          }
        );


      const createOrder =
        db.transaction(
          () => {

            const result =
              db
                .prepare(
                  `
                  INSERT INTO orders
                  (
                    user_id,
                    total,
                    status,
                    customer_name,
                    customer_phone,
                    delivery_address,
                    notes
                  )
                  VALUES
                  (
                    ?,
                    ?,
                    'Pending',
                    ?,
                    ?,
                    ?,
                    ?
                  )
                  `
                )
                .run(
                  req.user.id,
                  total,
                  customerName,
                  customerPhone,
                  address,
                  noteText
                );


            const orderId =
              result.lastInsertRowid;


            const insertItem =
              db.prepare(
                `
                INSERT INTO order_items
                (
                  order_id,
                  menu_item_id,
                  item_name,
                  price,
                  quantity,
                  subtotal
                )
                VALUES
                (
                  ?,
                  ?,
                  ?,
                  ?,
                  ?,
                  ?
                )
                `
              );


            resolved.forEach(
              (item) => {

                insertItem.run(
                  orderId,
                  item.menuItemId,
                  item.itemName,
                  item.price,
                  item.quantity,
                  item.subtotal
                );

              }
            );


            return orderId;
          }
        );


      const orderId =
        createOrder();


      createStatusNotification(
        req.user.id,
        orderId,
        'Pending'
      );


      const order =
        db
          .prepare(
            'SELECT * FROM orders WHERE id = ?'
          )
          .get(orderId);


      res.status(201).json({
        order:
          getOrderPayload(order),
      });

    } catch (error) {

      console.error(error);

      res.status(500).json({
        message:
          'Could not create order',
      });
    }
  }
);


// ============================================================
// MY ORDERS
// ============================================================

app.get(
  '/api/orders/my',
  requireAuth,
  (req, res) => {

    const orders =
      db
        .prepare(
          `
          SELECT *
          FROM orders
          WHERE user_id = ?
          ORDER BY created_at DESC, id DESC
          `
        )
        .all(
          req.user.id
        );


    res.json({
      orders:
        orders.map(
          getOrderPayload
        ),
    });

  }
);


// ============================================================
// SINGLE ORDER
// ============================================================

app.get(
  '/api/orders/:id',
  requireAuth,
  (req, res) => {

    const order =
      db
        .prepare(
          'SELECT * FROM orders WHERE id = ?'
        )
        .get(
          req.params.id
        );


    if (!order) {

      return res.status(404).json({
        message:
          'Order not found',
      });

    }


    if (
      req.user.role !== 'admin' &&
      order.user_id !== req.user.id
    ) {

      return res.status(403).json({
        message:
          'Not allowed',
      });

    }


    res.json({
      order:
        getOrderPayload(order),
    });

  }
);


// ============================================================
// GET REVIEW FOR ORDER
// ============================================================

app.get(
  '/api/orders/:id/review',
  requireAuth,
  (req, res) => {

    const order =
      db
        .prepare(
          'SELECT * FROM orders WHERE id = ?'
        )
        .get(
          req.params.id
        );


    if (!order) {

      return res.status(404).json({
        message:
          'Order not found',
      });

    }


    if (
      req.user.role !== 'admin' &&
      order.user_id !== req.user.id
    ) {

      return res.status(403).json({
        message:
          'Not allowed',
      });

    }


    res.json({
      review:
        normalizeReview(
          getReviewForOrder(
            order.id
          )
        ),
    });

  }
);


// ============================================================
// CREATE / UPDATE REVIEW
// ============================================================

app.post(
  '/api/orders/:id/review',
  requireAuth,
  (req, res) => {

    try {

      const order =
        db
          .prepare(
            'SELECT * FROM orders WHERE id = ?'
          )
          .get(
            req.params.id
          );


      if (!order) {

        return res.status(404).json({
          message:
            'Order not found',
        });

      }


      if (
        order.user_id !==
        req.user.id
      ) {

        return res.status(403).json({
          message:
            'You can only review your own orders',
        });

      }


      if (
        order.status !==
        'Completed'
      ) {

        return res.status(400).json({
          message:
            'You can review an order after it has been delivered',
        });

      }


      const rating =
        Number(
          req.body.rating
        );

      const comment =
        String(
          req.body.comment ||
          ''
        ).trim();


      if (
        !Number.isInteger(rating) ||
        rating < 1 ||
        rating > 5
      ) {

        return res.status(400).json({
          message:
            'Rating must be between 1 and 5',
        });

      }


      if (
        comment.length > 500
      ) {

        return res.status(400).json({
          message:
            'Review comment must be 500 characters or fewer',
        });

      }


      const existing =
        db
          .prepare(
            'SELECT id FROM reviews WHERE order_id = ?'
          )
          .get(
            order.id
          );


      if (existing) {

        db.prepare(
          `
          UPDATE reviews
          SET
            rating = ?,
            comment = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
          `
        ).run(
          rating,
          comment,
          existing.id
        );

      } else {

        db.prepare(
          `
          INSERT INTO reviews
          (
            order_id,
            user_id,
            rating,
            comment
          )
          VALUES
          (
            ?,
            ?,
            ?,
            ?
          )
          `
        ).run(
          order.id,
          req.user.id,
          rating,
          comment
        );
      }


      res.status(
        existing ? 200 : 201
      ).json({
        review:
          normalizeReview(
            getReviewForOrder(
              order.id
            )
          ),
      });

    } catch (error) {

      console.error(error);

      res.status(500).json({
        message:
          'Could not save review',
      });
    }
  }
);


// ============================================================
// REVIEW SUMMARY
// ============================================================

app.get(
  '/api/reviews/summary',
  (req, res) => {

    const summary =
      db
        .prepare(
          `
          SELECT
            COUNT(*) AS count,
            COALESCE(
              AVG(rating),
              0
            ) AS average
          FROM reviews
          `
        )
        .get();


    res.json({
      count:
        Number(
          summary.count
        ),

      average:
        Number(
          Number(
            summary.average
          ).toFixed(1)
        ),
    });

  }
);


// ============================================================
// CUSTOMER NOTIFICATIONS
// ============================================================

app.get(
  '/api/notifications',
  requireAuth,
  (req, res) => {

    const notifications =
      db
        .prepare(
          `
          SELECT *
          FROM notifications
          WHERE user_id = ?
          ORDER BY created_at DESC, id DESC
          LIMIT 50
          `
        )
        .all(
          req.user.id
        );


    const unreadCount =
      db
        .prepare(
          `
          SELECT COUNT(*) AS count
          FROM notifications
          WHERE user_id = ?
          AND is_read = 0
          `
        )
        .get(
          req.user.id
        ).count;


    res.json({
      notifications:
        notifications.map(
          normalizeNotification
        ),

      unreadCount:
        Number(
          unreadCount
        ),
    });

  }
);


// ============================================================
// MARK ONE NOTIFICATION READ
// ============================================================

app.patch(
  '/api/notifications/:id/read',
  requireAuth,
  (req, res) => {

    const result =
      db
        .prepare(
          `
          UPDATE notifications
          SET is_read = 1
          WHERE id = ?
          AND user_id = ?
          `
        )
        .run(
          req.params.id,
          req.user.id
        );


    if (!result.changes) {

      return res.status(404).json({
        message:
          'Notification not found',
      });

    }


    res.json({
      message:
        'Notification marked as read',
    });

  }
);


// ============================================================
// MARK ALL NOTIFICATIONS READ
// ============================================================

app.patch(
  '/api/notifications/read-all',
  requireAuth,
  (req, res) => {

    db.prepare(
      `
      UPDATE notifications
      SET is_read = 1
      WHERE user_id = ?
      `
    ).run(
      req.user.id
    );


    res.json({
      message:
        'All notifications marked as read',
    });

  }
);


// ============================================================
// ADMIN - MENU
// ============================================================

app.get(
  '/api/admin/menu',
  requireAuth,
  requireAdmin,
  (req, res) => {

    const items =
      db
        .prepare(
          `
          SELECT *
          FROM menu_items
          ORDER BY id DESC
          `
        )
        .all()
        .map(
          normalizeMenu
        );


    res.json({
      items,
    });

  }
);


// ============================================================
// ADMIN - CREATE MENU
// ============================================================

app.post(
  '/api/admin/menu',
  requireAuth,
  requireAdmin,
  (req, res) => {

    const {
      name,
      category,
      description = '',
      price,
      image = '',
      available = true,
    } = req.body;


    const numericPrice =
      Number(price);


    if (
      !name ||
      !category ||
      !Number.isFinite(
        numericPrice
      ) ||
      numericPrice < 0
    ) {

      return res.status(400).json({
        message:
          'Name, category and valid price are required',
      });

    }


    const result =
      db
        .prepare(
          `
          INSERT INTO menu_items
          (
            name,
            category,
            description,
            price,
            image,
            available
          )
          VALUES
          (
            ?,
            ?,
            ?,
            ?,
            ?,
            ?
          )
          `
        )
        .run(
          String(name).trim(),
          String(category).trim(),
          String(description),
          numericPrice,
          String(image),
          available ? 1 : 0
        );


    const item =
      db
        .prepare(
          'SELECT * FROM menu_items WHERE id = ?'
        )
        .get(
          result.lastInsertRowid
        );


    res.status(201).json({
      item:
        normalizeMenu(item),
    });

  }
);


// ============================================================
// ADMIN - UPDATE MENU
// ============================================================

app.patch(
  '/api/admin/menu/:id',
  requireAuth,
  requireAdmin,
  (req, res) => {

    const current =
      db
        .prepare(
          'SELECT * FROM menu_items WHERE id = ?'
        )
        .get(
          req.params.id
        );


    if (!current) {

      return res.status(404).json({
        message:
          'Menu item not found',
      });

    }


    const name =
      req.body.name !== undefined
        ? String(
            req.body.name
          ).trim()
        : current.name;

    const category =
      req.body.category !== undefined
        ? String(
            req.body.category
          ).trim()
        : current.category;

    const description =
      req.body.description !== undefined
        ? String(
            req.body.description
          )
        : current.description;

    const price =
      req.body.price !== undefined
        ? Number(
            req.body.price
          )
        : current.price;

    const image =
      req.body.image !== undefined
        ? String(
            req.body.image
          )
        : current.image;

    const available =
      req.body.available !== undefined
        ? (
            req.body.available
              ? 1
              : 0
          )
        : current.available;


    if (
      !name ||
      !category ||
      !Number.isFinite(price) ||
      price < 0
    ) {

      return res.status(400).json({
        message:
          'Invalid menu item data',
      });

    }


    db.prepare(
      `
      UPDATE menu_items
      SET
        name = ?,
        category = ?,
        description = ?,
        price = ?,
        image = ?,
        available = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `
    ).run(
      name,
      category,
      description,
      price,
      image,
      available,
      req.params.id
    );


    const item =
      db
        .prepare(
          'SELECT * FROM menu_items WHERE id = ?'
        )
        .get(
          req.params.id
        );


    res.json({
      item:
        normalizeMenu(item),
    });

  }
);


// ============================================================
// ADMIN - DELETE MENU
// ============================================================

app.delete(
  '/api/admin/menu/:id',
  requireAuth,
  requireAdmin,
  (req, res) => {

    const item =
      db
        .prepare(
          'SELECT * FROM menu_items WHERE id = ?'
        )
        .get(
          req.params.id
        );


    if (!item) {

      return res.status(404).json({
        message:
          'Menu item not found',
      });

    }


    const used =
      db
        .prepare(
          `
          SELECT COUNT(*) AS count
          FROM order_items
          WHERE menu_item_id = ?
          `
        )
        .get(
          req.params.id
        ).count > 0;


    if (used) {

      db
        .prepare(
          `
          UPDATE menu_items
          SET
            available = 0,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
          `
        )
        .run(
          req.params.id
        );


      return res.json({
        message:
          'Item has order history, so it was marked unavailable instead of deleted',
      });

    }


    db
      .prepare(
        'DELETE FROM menu_items WHERE id = ?'
      )
      .run(
        req.params.id
      );


    res.json({
      message:
        'Menu item deleted',
    });

  }
);


// ============================================================
// ADMIN - ALL ORDERS
// ============================================================

app.get(
  '/api/admin/orders',
  requireAuth,
  requireAdmin,
  (req, res) => {

    const status =
      req.query.status;


    let orders;


    if (
      status &&
      status !== 'All'
    ) {

      orders =
        db
          .prepare(
            `
            SELECT *
            FROM orders
            WHERE status = ?
            ORDER BY created_at DESC, id DESC
            `
          )
          .all(
            status
          );

    } else {

      orders =
        db
          .prepare(
            `
            SELECT *
            FROM orders
            ORDER BY created_at DESC, id DESC
            `
          )
          .all();

    }


    const result =
      orders.map(
        (order) => {

          const base =
            getOrderPayload(
              order
            );


          const user =
            db
              .prepare(
                `
                SELECT email, phone
                FROM users
                WHERE id = ?
                `
              )
              .get(
                order.user_id
              );


          return {
            ...base,

            customer: {
              ...base.customer,

              email:
                user?.email?.endsWith(
                  '@phone.local'
                )
                  ? null
                  : (
                      user?.email ||
                      null
                    ),

              accountPhone:
                user?.phone ||
                null,
            },
          };
        }
      );


    res.json({
      orders: result,
    });

  }
);


// ============================================================
// ADMIN - UPDATE ORDER STATUS
// ============================================================

app.patch(
  '/api/admin/orders/:id/status',
  requireAuth,
  requireAdmin,
  (req, res) => {

    const allowed =
      new Set([
        'Pending',
        'Preparing',
        'Ready',
        'Completed',
        'Cancelled',
      ]);


    const status =
      String(
        req.body.status || ''
      );


    if (
      !allowed.has(status)
    ) {

      return res.status(400).json({
        message:
          'Invalid order status',
      });

    }


    const current =
      db
        .prepare(
          'SELECT * FROM orders WHERE id = ?'
        )
        .get(
          req.params.id
        );


    if (!current) {

      return res.status(404).json({
        message:
          'Order not found',
      });

    }


    db.prepare(
      `
      UPDATE orders
      SET
        status = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `
    ).run(
      status,
      req.params.id
    );


    createStatusNotification(
      current.user_id,
      current.id,
      status
    );


    const order =
      db
        .prepare(
          'SELECT * FROM orders WHERE id = ?'
        )
        .get(
          req.params.id
        );


    res.json({
      order:
        getOrderPayload(
          order
        ),
    });

  }
);


// ============================================================
// ADMIN - REVIEWS
// ============================================================

app.get(
  '/api/admin/reviews',
  requireAuth,
  requireAdmin,
  (req, res) => {

    const rows =
      db
        .prepare(
          `
          SELECT
            r.*,
            o.customer_name,
            o.id AS order_id,
            u.email
          FROM reviews r
          JOIN orders o
            ON o.id = r.order_id
          JOIN users u
            ON u.id = r.user_id
          ORDER BY
            r.created_at DESC,
            r.id DESC
          LIMIT 100
          `
        )
        .all();


    res.json({
      reviews:
        rows.map(
          (row) => ({

            ...normalizeReview(
              row
            ),

            customerName:
              row.customer_name,

            email:
              row.email?.endsWith(
                '@phone.local'
              )
                ? null
                : row.email,
          })
        ),
    });

  }
);


// ============================================================
// ADMIN - STATS
// ============================================================

app.get(
  '/api/admin/stats',
  requireAuth,
  requireAdmin,
  (req, res) => {

    const orders =
      db
        .prepare(
          `
          SELECT COUNT(*) AS count
          FROM orders
          `
        )
        .get()
        .count;


    const pending =
      db
        .prepare(
          `
          SELECT COUNT(*) AS count
          FROM orders
          WHERE status = 'Pending'
          `
        )
        .get()
        .count;


    const preparing =
      db
        .prepare(
          `
          SELECT COUNT(*) AS count
          FROM orders
          WHERE status = 'Preparing'
          `
        )
        .get()
        .count;


    const ready =
      db
        .prepare(
          `
          SELECT COUNT(*) AS count
          FROM orders
          WHERE status = 'Ready'
          `
        )
        .get()
        .count;


    const completed =
      db
        .prepare(
          `
          SELECT COUNT(*) AS count
          FROM orders
          WHERE status = 'Completed'
          `
        )
        .get()
        .count;


    const cancelled =
      db
        .prepare(
          `
          SELECT COUNT(*) AS count
          FROM orders
          WHERE status = 'Cancelled'
          `
        )
        .get()
        .count;


    const revenue =
      db
        .prepare(
          `
          SELECT
            COALESCE(
              SUM(total),
              0
            ) AS total
          FROM orders
          WHERE status = 'Completed'
          `
        )
        .get()
        .total;


    const customers =
      db
        .prepare(
          `
          SELECT COUNT(*) AS count
          FROM users
          WHERE role = 'customer'
          `
        )
        .get()
        .count;


    const menuItems =
      db
        .prepare(
          `
          SELECT COUNT(*) AS count
          FROM menu_items
          WHERE available = 1
          `
        )
        .get()
        .count;


    const reviewSummary =
      db
        .prepare(
          `
          SELECT
            COUNT(*) AS count,
            COALESCE(
              AVG(rating),
              0
            ) AS average
          FROM reviews
          `
        )
        .get();


    res.json({
      stats: {

        orders:
          Number(
            orders
          ),

        pending:
          Number(
            pending
          ),

        preparing:
          Number(
            preparing
          ),

        ready:
          Number(
            ready
          ),

        completed:
          Number(
            completed
          ),

        cancelled:
          Number(
            cancelled
          ),

        revenue:
          Number(
            revenue
          ),

        customers:
          Number(
            customers
          ),

        menuItems:
          Number(
            menuItems
          ),

        reviews:
          Number(
            reviewSummary.count
          ),

        averageRating:
          Number(
            Number(
              reviewSummary.average
            ).toFixed(1)
          ),

      },
    });

  }
);


// ============================================================
// FRONTEND ROUTES
// ============================================================

// Home page
app.get(
  '/',
  (req, res) => {

    res.sendFile(
      path.join(
        frontendDir,
        'index.html'
      )
    );

  }
);


// Login page
app.get(
  '/login',
  (req, res) => {

    res.sendFile(
      path.join(
        frontendDir,
        'login.html'
      )
    );

  }
);


// Register page
app.get(
  '/register',
  (req, res) => {

    res.sendFile(
      path.join(
        frontendDir,
        'register.html'
      )
    );

  }
);


// Menu page
app.get(
  '/menu',
  (req, res) => {

    res.sendFile(
      path.join(
        frontendDir,
        'menu.html'
      )
    );

  }
);


// Cart page
app.get(
  '/cart',
  (req, res) => {

    res.sendFile(
      path.join(
        frontendDir,
        'cart.html'
      )
    );

  }
);


// Checkout page
app.get(
  '/checkout',
  (req, res) => {

    res.sendFile(
      path.join(
        frontendDir,
        'checkout.html'
      )
    );

  }
);


// Orders page
app.get(
  '/orders',
  (req, res) => {

    res.sendFile(
      path.join(
        frontendDir,
        'orders.html'
      )
    );

  }
);


// Admin page
app.get(
  '/admin',
  (req, res) => {

    res.sendFile(
      path.join(
        frontendDir,
        'admin.html'
      )
    );

  }
);


// Success page
app.get(
  '/success',
  (req, res) => {

    res.sendFile(
      path.join(
        frontendDir,
        'success.html'
      )
    );

  }
);


// ============================================================
// 404
// ============================================================

app.use(
  (req, res) => {

    res.status(404).json({
      message:
        'Route not found',
    });

  }
);


// ============================================================
// ERROR HANDLER
// ============================================================

app.use(
  (
    err,
    req,
    res,
    next
  ) => {

    console.error(err);

    res.status(500).json({
      message:
        'Internal server error',
    });

  }
);


// ============================================================
// START SERVER
// ============================================================

app.listen(
  PORT,
  () => {

    console.log(
      `Hotel Order API running at http://localhost:${PORT}`
    );

    console.log(
      `Frontend directory: ${frontendDir}`
    );

    console.log(
      `Health check: http://localhost:${PORT}/api/health`
    );

  }
);