const express = require("express");
const path = require("path");
const fs = require("fs");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const session = require("express-session");

const app = express();

const requireAdmin = (req, res, next) => {
    if (!req.session.user) {
        return res.status(401).json({
            message: "Please log in first."
        });
    }

    if (req.session.user.role !== "ADMIN") {
        return res.status(403).json({
            message: "Access denied. Admin only."
        });
    }

    next();
};
const requireRestaurantOwner = (req, res, next) => {
    if (!req.session.user) {
        return res.status(401).json({
            message: "Please log in first."
        });
    }

    if (req.session.user.role !== "RESTAURANT_OWNER") {
        return res.status(403).json({
            message: "Access denied. Restaurant owners only."
        });
    }

    next();
};
const PORT = process.env.PORT || 3000;
const dataFolder = path.join(__dirname, "data");

if (!fs.existsSync(dataFolder)) {
    fs.mkdirSync(dataFolder, { recursive: true });
}

app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || "foodmunch-dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);
app.use(express.static(path.join(__dirname, "public")));

let db;

const startingFoods = [
    { name: "Classic Veg Burger", category: "Starters", price: 129, image: "https://images.unsplash.com/photo-1520072959219-c595dc870360?auto=format&fit=crop&w=900&q=80", description: "Crispy, fresh and full of flavour." },
    { name: "Crispy Chicken Burger", category: "Starters", price: 179, image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=80", description: "Crunchy chicken with our house sauce." },
    { name: "Hyderabadi Biryani", category: "Main Course", price: 249, image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQYqny9GqzbcCscd5awIcBj9kmFnRHb_FBvYULzqRyvfQ&s=10", description: "Fragrant rice with classic spices." },
    { name: "Paneer Biryani", category: "Main Course", price: 219, image: "https://images.unsplash.com/photo-1589302168068-964664d93dc0?auto=format&fit=crop&w=900&q=80", description: "A flavourful vegetarian favourite." },
    { name: "Garden Fresh Salad", category: "Healthy", price: 149, image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=80", description: "Fresh greens, colourful vegetables." },
    { name: "Chocolate Brownie", category: "Desserts", price: 99, image: "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=900&q=80", description: "Rich chocolate, soft centre." },
    { name: "Strawberry Cheesecake", category: "Desserts", price: 159, image: "https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&w=900&q=80", description: "Creamy cheesecake with berries." },
    { name: "Cold Coffee", category: "Drinks", price: 109, image: "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=900&q=80", description: "Chilled coffee for a refreshing break." }
];

async function initializeDatabase() {
    db = await open({
        filename: path.join(dataFolder, "foodmunch.db"),
        driver: sqlite3.Database
    });

    await db.exec(`
        CREATE TABLE IF NOT EXISTS foods (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            price INTEGER NOT NULL,
            image TEXT NOT NULL,
            description TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER REFERENCES users(id),
        customer_name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT NOT NULL,
        address TEXT NOT NULL,
        items_json TEXT NOT NULL,
        total INTEGER NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

                CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE COLLATE NOCASE,
            password_hash TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS restaurants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id INTEGER NOT NULL,
    restaurant_name TEXT NOT NULL,
    address TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id)
);
    `);

    // Add user_id to the existing orders table if it is missing
    const orderColumns = await db.all("PRAGMA table_info(orders)");


    // Add role column to existing users table if missing
    const userColumns = await db.all("PRAGMA table_info(users)");

    // Add restaurant_id to foods table if missing
const foodColumns = await db.all("PRAGMA table_info(foods)");

const hasRestaurantId = foodColumns.some(
    (column) => column.name === "restaurant_id"
);

if (!hasRestaurantId) {
    await db.exec(
        "ALTER TABLE foods ADD COLUMN restaurant_id INTEGER REFERENCES restaurants(id)"
    );
}

    const hasRole = userColumns.some(
        (column) => column.name === "role"
    );

    if (!hasRole) {
        await db.exec(
            "ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'CUSTOMER'"
        );
    }

    await db.run(
    `UPDATE users
     SET role = 'CUSTOMER'
     WHERE role IS NULL OR role = ''`
);

    // Add status column to existing orders table if missing
    const hasStatus = orderColumns.some(
        (column) => column.name === "status"
    );

    if (!hasStatus) {
        await db.exec(
            "ALTER TABLE orders ADD COLUMN status TEXT NOT NULL DEFAULT 'PLACED'"
        );
    }

    const hasUserId = orderColumns.some(
        (column) => column.name === "user_id"
    );

    if (!hasUserId) {
        await db.exec(
            "ALTER TABLE orders ADD COLUMN user_id INTEGER REFERENCES users(id)"
        );
    }
// Add restaurant_id to existing orders table
const hasOrderRestaurantId = orderColumns.some(
    (column) => column.name === "restaurant_id"
);

if (!hasOrderRestaurantId) {

    const existingFoods = await db.get("SELECT COUNT(*) AS count FROM foods");
    if (existingFoods.count === 0) {
        for (const food of startingFoods) {
            await db.run(
                "INSERT INTO foods (name, category, price, image, description) VALUES (?, ?, ?, ?, ?)",
                [food.name, food.category, food.price, food.image, food.description]
            );
        }
    }
}

app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "FoodMunch API is running" });
});


app.post("/api/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Name, email, and password are required.",
      });
    }

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({
        message: "Please enter a valid name and email.",
      });
    }

    if (typeof password !== "string" || password.length < 8) {
      return res.status(400).json({
        message: "Password must contain at least 8 characters.",
      });
    }

    const existingUser = await db.get(
      "SELECT id FROM users WHERE email = ?",
      [cleanEmail]
    );

    if (existingUser) {
      return res.status(409).json({
        message: "An account with this email already exists.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await db.run(
      `INSERT INTO users (name, email, password_hash, role)
     VALUES (?, ?, ?, ?)`,
    [
        name.trim(),
        email.trim(),
        passwordHash,
        "CUSTOMER"
    ]
    );

   req.session.user = {
    id: result.lastID,
    name: cleanName,
    email: cleanEmail,
    role: "CUSTOMER",
};

    return res.status(201).json({
      message: "Account created successfully.",
      user: req.session.user,
    });
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return res.status(409).json({
        message: "An account with this email already exists.",
      });
    }

    console.error("Signup error:", error);

    return res.status(500).json({
      message: "Unable to create your account.",
    });
  }
});


app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required.",
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    const user = await db.get(
      "SELECT * FROM users WHERE email = ?",
      [cleanEmail]
    );

    if (!user) {
      return res.status(401).json({
        message: "Invalid email or password.",
      });
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!passwordMatches) {
      return res.status(401).json({
        message: "Invalid email or password.",
      });
    }

    req.session.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    return res.json({
      message: "Login successful.",
      user: req.session.user,
    });
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      message: "Unable to log in.",
    });
  }
});

app.get("/api/foods", async (req, res) => {
    try {
        const search = (req.query.search || "").trim();
        const category = (req.query.category || "").trim();

        let sql = "SELECT id, name, category, price, image, description FROM foods WHERE 1 = 1";
        const values = [];

        if (search) {
            sql += " AND (name LIKE ? OR description LIKE ?)";
            values.push(`%${search}%`, `%${search}%`);
        }

        if (category && category !== "All") {
            sql += " AND category = ?";
            values.push(category);
        }

        sql += " ORDER BY id";
        const foods = await db.all(sql, values);
        res.json(foods);
    } catch (error) {
        console.error("Could not load foods:", error);
        res.status(500).json({ message: "Could not load the menu." });
    }
});

app.post("/api/orders", async (req, res) => {
        if (!req.session.user) {
        return res.status(401).json({
            message: "Please log in before placing your order."
        });
    }
    try {
        const { customerName, email, phone, address, items } = req.body;

        if (!customerName || !email || !phone || !address || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ message: "Please complete all fields and add at least one item." });
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ message: "Please enter a valid email address." });
        }

        // Recalculate prices on the server. Never trust prices sent by the browser.
        let total = 0;
        const verifiedItems = [];

        for (const item of items) {
            const foodId = Number(item.id);
            const quantity = Number(item.quantity);

            if (!Number.isInteger(foodId) || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
                return res.status(400).json({ message: "One of the order quantities is invalid." });
            }

            const food = await db.get("SELECT id, name, price FROM foods WHERE id = ?", [foodId]);
            if (!food) {
                return res.status(400).json({ message: "A selected food item no longer exists." });
            }

            total += food.price * quantity;
            verifiedItems.push({ id: food.id, name: food.name, price: food.price, quantity });
        }

        

const result = await db.run(
    `INSERT INTO orders
        (user_id, customer_name, email, phone, address, items_json, total, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
        req.session.user.id,
        customerName.trim(),
        email.trim(),
        phone.trim(),
        address.trim(),
        JSON.stringify(verifiedItems),
        total,
        "PLACED"
    ]
);



        res.status(201).json({
            message: "Your demo order was placed successfully!",
            orderId: result.lastID,
            total
        });
    } catch (error) {
        console.error("Could not place order:", error);
        res.status(500).json({ message: "Something went wrong while placing the order." });
    }
});


/* GET ORDERS FOR THE LOGGED-IN USER */

app.get("/api/my-orders", async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({
            message: "Please log in to view your orders."
        });
    }

    try {
        const orders = await db.all(
            
`SELECT id, customer_name, items_json, total, created_at, status
 FROM orders
 WHERE user_id = ?
 ORDER BY id DESC`,

            [req.session.user.id]
        );

        
const formattedOrders = orders.map((order) => ({
    id: order.id,
    customerName: order.customer_name,
    items: JSON.parse(order.items_json),
    total: order.total,
    createdAt: order.created_at,
    status: order.status
}));


        res.json({ orders: formattedOrders });
    } catch (error) {
        console.error("Could not fetch orders:", error);
        res.status(500).json({
            message: "Could not load your orders."
        });
    }
});


/* ADMIN - GET ALL ORDERS */

app.get("/api/admin/orders", requireAdmin, async (req, res) => {
    try {
        const orders = await db.all(
            `SELECT
                orders.id,
                orders.customer_name,
                orders.email,
                orders.phone,
                orders.address,
                orders.items_json,
                orders.total,
                orders.created_at,
                orders.status,
                users.name AS user_name
             FROM orders
             JOIN users ON orders.user_id = users.id
             ORDER BY orders.id DESC`
        );

        const formattedOrders = orders.map((order) => ({
            id: order.id,
            customerName: order.customer_name,
            email: order.email,
            phone: order.phone,
            address: order.address,
            items: JSON.parse(order.items_json),
            total: order.total,
            createdAt: order.created_at,
            status: order.status,
            userName: order.user_name
        }));

        res.json({ orders: formattedOrders });

    } catch (error) {
        console.error("Admin orders error:", error);

        res.status(500).json({
            message: "Could not load all orders."
        });
    }
});
app.post("/api/admin/restaurants", requireAdmin, async (req, res) => {
    try {
        const { ownerEmail, restaurantName, address } = req.body;

        if (!ownerEmail || !restaurantName || !address) {
            return res.status(400).json({
                message: "All fields are required."
            });
        }

        const owner = await db.get(
            "SELECT id FROM users WHERE email = ?",
            [ownerEmail.trim().toLowerCase()]
        );

        if (!owner) {
            return res.status(404).json({
                message: "Owner account not found."
            });
        }

        const result = await db.run(
            `INSERT INTO restaurants (owner_id, restaurant_name, address)
             VALUES (?, ?, ?)`,
            [owner.id, restaurantName.trim(), address.trim()]
        );

        await db.run(
            "UPDATE users SET role = 'RESTAURANT_OWNER' WHERE id = ?",
            [owner.id]
        );

        res.status(201).json({
            message: "Restaurant registered successfully.",
            restaurantId: result.lastID
        });

    } catch (error) {
        console.error("Restaurant registration error:", error);

        res.status(500).json({
            message: "Could not register restaurant."
        });
    }
});
app.get("/api/owner/restaurants", requireRestaurantOwner, async (req, res) => {
    try {
        const restaurants = await db.all(
            `SELECT id, restaurant_name, address
             FROM restaurants
             WHERE owner_id = ?
             ORDER BY id DESC`,
            [req.session.user.id]
        );

        res.json({ restaurants });

    } catch (error) {
        console.error("Owner restaurants error:", error);

        res.status(500).json({
            message: "Could not load your restaurants."
        });
    }
});
/* CANCEL AN ORDER */

app.put("/api/orders/:orderId/cancel", async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({
            message: "Please log in to cancel an order."
        });
    }

    try {
        const orderId = req.params.orderId;

        const order = await db.get(
            `SELECT * FROM orders
             WHERE id = ? AND user_id = ?`,
            [orderId, req.session.user.id]
        );

        if (!order) {
            return res.status(404).json({
                message: "Order not found."
            });
        }

        if (order.status === "CANCELLED") {
            return res.status(400).json({
                message: "This order is already cancelled."
            });
        }

        await db.run(
            `UPDATE orders
             SET status = 'CANCELLED'
             WHERE id = ? AND user_id = ?`,
            [orderId, req.session.user.id]
        );

        res.json({
            message: "Order cancelled successfully."
        });

    } catch (error) {
        console.error("Order cancellation error:", error);

        res.status(500).json({
            message: "Could not cancel the order."
        });
    }
});


app.get("/api/me", (req, res) => {
  res.json({
    user: req.session.user || null,
  });
});

app.post("/api/logout", (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      return res.status(500).json({
        message: "Unable to log out.",
      });
    }

    res.clearCookie("connect.sid", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    return res.json({
      message: "Logged out successfully.",
    });
  });
});

// Send the homepage for normal page routes.
app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

initializeDatabase()
    .then(() => {
        app.listen(PORT, "0.0.0.0", () => {
            console.log(`FoodMunch is running at http://localhost:${PORT}`);
        });
    })
    .catch((error) => {
        console.error("Could not start the server:", error);
        process.exit(1);
    });
