const foodGrid = document.getElementById("foodGrid");
const menuStatus = document.getElementById("menuStatus");
const searchInput = document.getElementById("searchInput");
const categoryList = document.getElementById("categoryList");
const cartCount = document.getElementById("cartCount");
const cartOverlay = document.getElementById("cartOverlay");
const cartItems = document.getElementById("cartItems");
const cartTotal = document.getElementById("cartTotal");
const checkoutTotal = document.getElementById("checkoutTotal");
const checkoutOverlay = document.getElementById("checkoutOverlay");
const checkoutForm = document.getElementById("checkoutForm");
const formMessage = document.getElementById("formMessage");
const toast = document.getElementById("toast");

let foods = [];
let selectedCategory = "All";
let cart = [];
let toastTimeout;

// Restore the cart saved in the browser
try {
    const savedCart = JSON.parse(
        localStorage.getItem("foodmunchCart") || "[]"
    );

    if (Array.isArray(savedCart)) {
        cart = savedCart.filter(item =>
            item &&
            Number.isFinite(item.id) &&
            Number.isFinite(item.price) &&
            Number.isInteger(item.quantity) &&
            item.quantity > 0
        );
    }
} catch (error) {
    cart = [];
}

function formatPrice(price) {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0
    }).format(price);
}

function showOrderConfirmation(orderId, total, order, orderedItems) {
    document.getElementById("confirmationOrderId").textContent =
        `#${orderId}`;

    document.getElementById("confirmationTotal").textContent =
        formatPrice(total);

    document.getElementById("confirmationCustomer").textContent =
        `${order.customerName} | ${order.phone}`;

    document.getElementById("confirmationAddress").textContent =
        order.address;

    document.getElementById("confirmationItems").innerHTML =
        orderedItems.map((item) => `
            <div class="confirmation-food-item">
                <div>
                    <strong>${escapeHtml(item.name)}</strong>
                    <p>Quantity: ${item.quantity} × ${formatPrice(item.price)}</p>
                </div>
                <strong>${formatPrice(item.price * item.quantity)}</strong>
            </div>
        `).join("");

    document.getElementById("orderConfirmation").hidden = false;
    document.body.classList.add("no-scroll");
}

function closeOrderConfirmation() {
    document.getElementById("orderConfirmation").hidden = true;
    document.body.classList.remove("no-scroll");
}

document.getElementById("continueShoppingButton").addEventListener("click", () => {
    closeOrderConfirmation();

    document.getElementById("exploreMenuSection")?.scrollIntoView({
        behavior: "smooth"
    });
});

function saveCart() {
    try {
        localStorage.setItem("foodmunchCart", JSON.stringify(cart));
    } catch (error) {
        console.error("Could not save cart:", error);
    }
}

async function loadFoods() {
    menuStatus.textContent = "Loading menu...";
    const params = new URLSearchParams();

    if (searchInput.value.trim()) {
        params.set("search", searchInput.value.trim());
    }
    if (selectedCategory !== "All") {
        params.set("category", selectedCategory);
    }

    try {
        const response = await fetch(`/api/foods?${params.toString()}`);
        if (!response.ok) {
            throw new Error("Menu request failed");
        }

        foods = await response.json();
        showFoods(foods);
        menuStatus.textContent = `${foods.length} delicious option${foods.length === 1 ? "" : "s"} found`;
    } catch (error) {
        menuStatus.textContent = "We could not load the menu. Please refresh the page.";
        foodGrid.innerHTML = "";
        console.error(error);
    }
}

function showFoods(foodList) {
    if (foodList.length === 0) {
        foodGrid.innerHTML = '<div class="empty-state"><h3>No dishes found</h3><p>Try a different search or category.</p></div>';
        return;
    }

    foodGrid.innerHTML = foodList.map((food) => `
        <article class="food-card">
            <div class="food-image-wrap">
                <img class="food-image" src="${escapeHtml(food.image)}" alt="${escapeHtml(food.name)}" loading="lazy">
                <span class="food-category">${escapeHtml(food.category)}</span>
            </div>
            <div class="food-details">
                <h3>${escapeHtml(food.name)}</h3>
                <p class="food-description">${escapeHtml(food.description)}</p>
                <div class="food-card-bottom">
                    <span class="food-price">${formatPrice(food.price)}</span>
                    <button class="add-button" data-add-id="${food.id}" type="button">＋ Add</button>
                </div>
            </div>
        </article>
    `).join("");
}

// Escaping text helps stop HTML from being interpreted as markup.
function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[character]);
}

function addToCart(foodId) {
    const food = foods.find((item) => item.id === Number(foodId));
    if (!food) return;

    const existingItem = cart.find((item) => item.id === food.id);
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({ ...food, quantity: 1 });
    }

    renderCart();
    showToast(`${food.name} added to cart`);
}

function changeQuantity(foodId, change) {
    const item = cart.find((cartItem) => cartItem.id === Number(foodId));
    if (!item) return;

    item.quantity += change;
    if (item.quantity <= 0) {
        cart = cart.filter((cartItem) => cartItem.id !== Number(foodId));
    }
    renderCart();
}

function removeFromCart(foodId) {
    cart = cart.filter((item) => item.id !== Number(foodId));
    renderCart();
}

function getCartTotal() {
    return cart.reduce((total, item) => total + item.price * item.quantity, 0);
}

function renderCart() {
    saveCart();

    const totalQuantity = cart.reduce((total, item) => total + item.quantity, 0);
    cartCount.textContent = totalQuantity;
    cartTotal.textContent = formatPrice(getCartTotal());
    checkoutTotal.textContent = formatPrice(getCartTotal());

    if (cart.length === 0) {
        cartItems.innerHTML = '<div class="cart-empty"><p style="font-size:2rem">🛒</p><h3>Your cart is empty</h3><p>Add a tasty dish from the menu.</p></div>';
        return;
    }

    cartItems.innerHTML = cart.map((item) => `
        <article class="cart-item">
            <img src="${escapeHtml(item.image)}" alt="">
            <div>
                <h3>${escapeHtml(item.name)}</h3>
                <p>${formatPrice(item.price)} each</p>
                <div class="quantity-controls">
                    <button type="button" data-quantity-id="${item.id}" data-change="-1" aria-label="Decrease ${escapeHtml(item.name)} quantity">−</button>
                    <strong>${item.quantity}</strong>
                    <button type="button" data-quantity-id="${item.id}" data-change="1" aria-label="Increase ${escapeHtml(item.name)} quantity">+</button>
                </div>
            </div>
            <button type="button" class="remove-item" data-remove-id="${item.id}">Remove</button>
        </article>
    `).join("");
}

function openCart() {
    cartOverlay.hidden = false;
    document.body.classList.add("no-scroll");
}

function closeCart() {
    cartOverlay.hidden = true;
    if (checkoutOverlay.hidden) document.body.classList.remove("no-scroll");
}

function openCheckout() {
    if (cart.length === 0) {
        showToast("Add at least one item before checkout.");
        return;
    }
    closeCart();
    checkoutOverlay.hidden = false;
    document.body.classList.add("no-scroll");
    formMessage.textContent = "";
}

function closeCheckout() {
    checkoutOverlay.hidden = true;
    document.body.classList.remove("no-scroll");
}

function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toast.classList.remove("show"), 2400);
}

foodGrid.addEventListener("click", (event) => {
    const button = event.target.closest("[data-add-id]");
    if (button) addToCart(button.dataset.addId);
});

cartItems.addEventListener("click", (event) => {
    const quantityButton = event.target.closest("[data-quantity-id]");
    const removeButton = event.target.closest("[data-remove-id]");

    if (quantityButton) {
        changeQuantity(quantityButton.dataset.quantityId, Number(quantityButton.dataset.change));
    }
    if (removeButton) {
        removeFromCart(removeButton.dataset.removeId);
    }
});

categoryList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-category]");
    if (!button) return;

    selectedCategory = button.dataset.category;
    categoryList.querySelectorAll(".category-button").forEach((categoryButton) => {
        categoryButton.classList.toggle("active", categoryButton === button);
    });
    loadFoods();
});

let searchDelay;
searchInput.addEventListener("input", () => {
    clearTimeout(searchDelay);
    searchDelay = setTimeout(loadFoods, 250);
});

document.getElementById("openCartButton").addEventListener("click", openCart);
document.getElementById("closeCartButton").addEventListener("click", closeCart);
document.getElementById("closeCartBackdrop").addEventListener("click", closeCart);
document.getElementById("checkoutButton").addEventListener("click", openCheckout);
document.getElementById("closeCheckoutButton").addEventListener("click", closeCheckout);
document.getElementById("closeCheckoutBackdrop").addEventListener("click", closeCheckout);

document.getElementById("navToggle").addEventListener("click", () => {
    const navLinks = document.getElementById("navLinks");
    const isOpen = navLinks.classList.toggle("open");
    document.getElementById("navToggle").setAttribute("aria-expanded", String(isOpen));
});

document.getElementById("navLinks").addEventListener("click", (event) => {
    if (event.target.closest("a")) {
        document.getElementById("navLinks").classList.remove("open");
        document.getElementById("navToggle").setAttribute("aria-expanded", "false");
    }
});

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
        closeCart();
        closeCheckout();
    }
});

checkoutForm.addEventListener("submit", async (event) => {
    event.preventDefault();

        const meResponse = await fetch("/api/me");
    const meResult = await meResponse.json();

    if (!meResult.user) {
        closeCheckout();
        openAuthForm("login");
        showToast("Please log in before placing your order.");
        return;
    }

    if (cart.length === 0) {
        formMessage.textContent = "Your cart is empty.";
        return;
    }

    const formData = new FormData(checkoutForm);
    const order = {
        customerName: formData.get("customerName").trim(),
        email: formData.get("email").trim(),
        phone: formData.get("phone").trim(),
        address: formData.get("address").trim(),
        items: cart.map((item) => ({ id: item.id, quantity: item.quantity }))
    };

    const orderedItems = cart.map((item) => ({ ...item }));

    const placeOrderButton = document.getElementById("placeOrderButton");
    placeOrderButton.disabled = true;
    placeOrderButton.textContent = "Placing order...";
    formMessage.textContent = "";

    try {
        const response = await fetch("/api/orders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(order)
        });

        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.message || "Could not place the order.");
        }

                    cart = [];
            renderCart();
            checkoutForm.reset();

            closeCheckout();

            showOrderConfirmation(
                result.orderId,
                result.total,
                order,
                orderedItems
            );

            showToast("Your demo order was placed!");
    } catch (error) {
        formMessage.classList.remove("success");
        formMessage.textContent = error.message || "Something went wrong. Please try again.";
    } finally {
        placeOrderButton.disabled = false;
        placeOrderButton.textContent = "Place demo order";
    }
});


/* LOGIN AND SIGNUP: OPEN AND CLOSE FORMS */

const authOverlay = document.getElementById("authOverlay");
const loginButton = document.getElementById("loginButton");

const myOrdersButton = document.getElementById("myOrdersButton");
const adminDashboardButton = document.getElementById("adminDashboardButton");
const adminDashboardOverlay = document.getElementById("adminDashboardOverlay");
const closeAdminDashboardButton = document.getElementById("closeAdminDashboardButton");
const adminDashboardMessage = document.getElementById("adminDashboardMessage");
const adminOrdersList = document.getElementById("adminOrdersList");
const myOrdersOverlay = document.getElementById("myOrdersOverlay");
const closeMyOrdersButton = document.getElementById("closeMyOrdersButton");
const myOrdersList = document.getElementById("myOrdersList");
const myOrdersMessage = document.getElementById("myOrdersMessage");

const signupButton = document.getElementById("signupButton");
const closeAuthButton = document.getElementById("closeAuthButton");

const loginForm = document.getElementById("loginForm");
const signupForm = document.getElementById("signupForm");

const authTitle = document.getElementById("authTitle");
const authDescription = document.getElementById("authDescription");


/* UPDATE NAVBAR BASED ON LOGIN STATUS */

function updateAuthUI(user) {
    const userGreeting = document.getElementById("userGreeting");
    const logoutButton = document.getElementById("logoutButton");
    const myOrdersButton = document.getElementById("myOrdersButton");

    if (user) {
        // Show website after successful login
        document.body.classList.add("authenticated");

        // Close login popup
        authOverlay.hidden = true;

        loginButton.hidden = true;
        signupButton.hidden = true;

        userGreeting.hidden = false;
        userGreeting.textContent = "Hi, " + user.name;

        logoutButton.hidden = false;
        myOrdersButton.hidden = false;

    } else {
        // Hide website when logged out
        document.body.classList.remove("authenticated");

        // Show login popup
        authOverlay.hidden = false;

        loginButton.hidden = true;
        signupButton.hidden = true;

        userGreeting.hidden = true;
        userGreeting.textContent = "";

        logoutButton.hidden = true;
        myOrdersButton.hidden = true;
    }

    // Show Admin Dashboard only for admin users
    adminDashboardButton.hidden = !user || user.role !== "ADMIN";
}


function openAuthForm(formType) {
    authOverlay.hidden = false;
    document.body.classList.add("no-scroll");

    loginForm.reset();
    signupForm.reset();

    document.getElementById("loginMessage").textContent = "";
    document.getElementById("signupMessage").textContent = "";

    if (formType === "signup") {
        loginForm.hidden = true;
        signupForm.hidden = false;
        authTitle.textContent = "Create Account";
        authDescription.textContent = "Join FoodMunch today!";
    } else {
        signupForm.hidden = true;
        loginForm.hidden = false;
        authTitle.textContent = "Login";
        authDescription.textContent = "Login to your FoodMunch account.";
    }
}

function closeAuthForm() {
    authOverlay.hidden = true;

    if (cartOverlay.hidden && checkoutOverlay.hidden) {
        document.body.classList.remove("no-scroll");
    }
}

loginButton.addEventListener("click", () => {
    openAuthForm("login");
});

signupButton.addEventListener("click", () => {
    openAuthForm("signup");
});

closeAuthButton.addEventListener("click", closeAuthForm);

document.getElementById("showSignupButton").addEventListener("click", () => {
    openAuthForm("signup");
});

document.getElementById("showLoginButton").addEventListener("click", () => {
    openAuthForm("login");
});

authOverlay.addEventListener("click", (event) => {
    if (event.target === authOverlay) {
        closeAuthForm();
    }
});


/* SIGNUP: CONNECT FORM TO BACKEND */

signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const signupMessage = document.getElementById("signupMessage");
    const signupSubmitButton = signupForm.querySelector('button[type="submit"]');

    const formData = new FormData(signupForm);

    const userData = {
        name: formData.get("name").trim(),
        email: formData.get("email").trim(),
        password: formData.get("password")
    };

    signupMessage.textContent = "";
    signupSubmitButton.disabled = true;
    signupSubmitButton.textContent = "Creating account...";

    try {
        const response = await fetch("/api/signup", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(userData)
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Signup failed.");
        }

        signupMessage.textContent = "Account created successfully!";
        signupMessage.classList.add("success");

        updateAuthUI(result.user);

        setTimeout(() => {
            closeAuthForm();
            showToast("Welcome to FoodMunch, " + result.user.name + "!");
        }, 800);

    } catch (error) {
        signupMessage.classList.remove("success");
        signupMessage.textContent = error.message;
    } finally {
        signupSubmitButton.disabled = false;
        signupSubmitButton.textContent = "Create Account";
    }
});


/* LOGIN: CONNECT FORM TO BACKEND */

loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const loginMessage = document.getElementById("loginMessage");
    const loginSubmitButton = loginForm.querySelector('button[type="submit"]');

    const formData = new FormData(loginForm);

    const userData = {
        email: formData.get("email").trim(),
        password: formData.get("password")
    };

    loginMessage.textContent = "";
    loginSubmitButton.disabled = true;
    loginSubmitButton.textContent = "Logging in...";

    try {
        const response = await fetch("/api/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(userData)
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Login failed.");
        }

        loginMessage.classList.remove("success");
        loginMessage.textContent = "Login successful!";

        updateAuthUI(result.user);

        setTimeout(() => {
            closeAuthForm();
            showToast("Welcome back, " + result.user.name + "!");
        }, 800);

    } catch (error) {
        loginMessage.classList.remove("success");
        loginMessage.textContent = error.message;
    } finally {
        loginSubmitButton.disabled = false;
        loginSubmitButton.textContent = "Login";
    }
});

/* LOGOUT: CONNECT TO BACKEND */

const logoutButton = document.getElementById("logoutButton");

logoutButton.addEventListener("click", async () => {
    try {
        const response = await fetch("/api/logout", {
            method: "POST"
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Logout failed.");
        }

        updateAuthUI(null);

        showToast("You have logged out successfully!");

    } catch (error) {
        showToast(error.message);
    }
});

/* RESTORE LOGIN STATUS AFTER PAGE REFRESH */

async function checkLoginStatus() {
    try {
        const response = await fetch("/api/me");
        const result = await response.json();

        updateAuthUI(result.user);
    } catch (error) {
        console.error("Unable to check login status:", error);
        updateAuthUI(null);
    }
}


/* MY ORDERS POPUP */


myOrdersButton.addEventListener("click", async () => {
    myOrdersOverlay.hidden = false;
    document.body.classList.add("no-scroll");

    myOrdersMessage.textContent = "Loading your orders...";
    myOrdersList.innerHTML = "";

    try {
        const response = await fetch("/api/my-orders");
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Could not load your orders.");
        }

        if (result.orders.length === 0) {
            myOrdersMessage.textContent = "You haven't placed any orders yet.";
            return;
        }

        myOrdersMessage.textContent = "";

        result.orders.forEach((order) => {
            const orderCard = document.createElement("div");
            orderCard.className = "order-card";

            const orderTitle = document.createElement("h3");
            orderTitle.textContent = "Order #" + order.id;
            orderCard.appendChild(orderTitle);

            const orderDate = document.createElement("p");
            orderDate.textContent = "Date: " + order.createdAt;
            orderCard.appendChild(orderDate);

            const orderStatus = document.createElement("p");
            orderStatus.textContent = "Status: " + order.status;
            orderCard.appendChild(orderStatus);

            const itemsList = document.createElement("p");
            itemsList.textContent = order.items
                .map((item) => item.name + " x " + item.quantity)
                .join(", ");
            orderCard.appendChild(itemsList);

            const orderTotal = document.createElement("p");
            orderTotal.textContent = "Total: ₹" + order.total;
            orderCard.appendChild(orderTotal);

            if (order.status !== "CANCELLED") {
                const cancelButton = document.createElement("button");

                cancelButton.textContent = "Cancel Order";
                cancelButton.className = "cancel-order-button";

                cancelButton.addEventListener("click", async () => {
                    const confirmCancel = confirm(
                        "Are you sure you want to cancel this order?"
                    );

                    if (!confirmCancel) {
                        return;
                    }

                    try {
                        const response = await fetch(
                            `/api/orders/${order.id}/cancel`,
                            {
                                method: "PUT"
                            }
                        );

                        const result = await response.json();

                        if (!response.ok) {
                            throw new Error(result.message);
                        }

                        alert(result.message);

                        myOrdersButton.click();

                    } catch (error) {
                        alert(error.message);
                    }
                });

                orderCard.appendChild(cancelButton);
            }

            myOrdersList.appendChild(orderCard);
        });

    } catch (error) {
        myOrdersMessage.textContent = error.message;
    }
});


// ADMIN DASHBOARD BUTTON

adminDashboardButton.addEventListener("click", async () => {
    adminDashboardOverlay.hidden = false;
    document.body.classList.add("no-scroll");

    adminDashboardMessage.textContent = "Loading all orders...";
    adminOrdersList.innerHTML = "";

    try {
        const response = await fetch("/api/admin/orders");
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Could not load orders.");
        }

        if (result.orders.length === 0) {
            adminDashboardMessage.textContent = "No orders found.";
            return;
        }

        adminDashboardMessage.textContent =
            "Total Orders: " + result.orders.length;
result.orders.forEach((order) => {
    const orderCard = document.createElement("div");
    orderCard.className = "order-card";

    const orderTitle = document.createElement("h3");
    orderTitle.textContent = "Order #" + order.id;
    orderCard.appendChild(orderTitle);

    const customerName = document.createElement("p");
    customerName.textContent = "Customer: " + order.customerName;
    orderCard.appendChild(customerName);

    const customerEmail = document.createElement("p");
    customerEmail.textContent = "Email: " + order.email;
    orderCard.appendChild(customerEmail);

    const customerPhone = document.createElement("p");
    customerPhone.textContent = "Phone: " + order.phone;
    orderCard.appendChild(customerPhone);

    const customerAddress = document.createElement("p");
    customerAddress.textContent = "Address: " + order.address;
    orderCard.appendChild(customerAddress);

    const orderItems = document.createElement("p");
    orderItems.textContent = "Items: " + order.items
        .map((item) => item.name + " x " + item.quantity)
        .join(", ");
    orderCard.appendChild(orderItems);

    const orderTotal = document.createElement("p");
    orderTotal.textContent = "Total: ₹" + order.total;
    orderCard.appendChild(orderTotal);

    const orderStatus = document.createElement("p");
    orderStatus.textContent = "Status: " + order.status;
    orderCard.appendChild(orderStatus);

    adminOrdersList.appendChild(orderCard);
});
    } catch (error) {
        adminDashboardMessage.textContent = error.message;
    }
});

closeAdminDashboardButton.addEventListener("click", () => {
    adminDashboardOverlay.hidden = true;
    document.body.classList.remove("no-scroll");
});

closeMyOrdersButton.addEventListener("click", () => {
    myOrdersOverlay.hidden = true;
    document.body.classList.remove("no-scroll");
});


checkLoginStatus();

loadFoods();
renderCart();
