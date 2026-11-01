# FoodMunch — Full-Stack Food Ordering Website

A beginner-friendly learning project built with HTML, CSS, JavaScript, Node.js, Express and SQLite.

## Features
- Responsive restaurant homepage
- Search and category filters
- Add/remove food items and change quantities in cart
- Checkout form validation
- Backend API for menu and orders
- SQLite database for menu items and orders
- Order confirmation message

## Run locally
1. Install Node.js (LTS).
2. Open this folder in VS Code.
3. Open the terminal and run:
   ```bash
   npm install
   npm start
   ```
4. Visit http://localhost:3000

The SQLite database is created automatically at `data/foodmunch.db`.

## Important learning/demo note
This is a portfolio project, not a production ordering system. Checkout is simulated: it does not collect payment. The SQLite database is suitable for local learning. Some free hosting services use temporary local storage, so orders may be lost after restarts/redeploys. For reliable production persistence, use a hosted database such as PostgreSQL and configure its connection securely.

## API routes
- `GET /api/foods` — list food items
- `GET /api/foods?category=Main%20Course` — filter by category
- `GET /api/foods?search=biryani` — search menu
- `POST /api/orders` — validate and save an order
- `GET /api/health` — health check

## Suggested resume description
Built a responsive full-stack food ordering website with search, category filtering, cart management, checkout validation, REST APIs, and SQLite persistence using HTML, CSS, JavaScript, Node.js and Express.
