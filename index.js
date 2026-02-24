const http = require("http")
const fs = require("fs")
const path = require("path")
const url = require("url")
const multer = require("multer")

// ─── Helpers ───────────────────────────────────────────────────
function readJSON(file) {
    try { return JSON.parse(fs.readFileSync(file, "utf-8")) }
    catch { return [] }
}
function writeJSON(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2))
}
function serveFile(res, filePath, contentType) {
    fs.readFile(filePath, (err, data) => {
        if (err) { res.writeHead(404); res.end("File not found"); return }
        res.writeHead(200, { "Content-Type": contentType })
        res.end(data)
    })
}
function getBody(req) {
    return new Promise((resolve) => {
        let body = ""
        req.on("data", chunk => body += chunk)
        req.on("end", () => { try { resolve(JSON.parse(body)) } catch { resolve({}) } })
    })
}
function jsonResponse(res, statusCode, data) {
    res.writeHead(statusCode, { "Content-Type": "application/json" })
    res.end(JSON.stringify(data))
}

// ─── MIME Types ─────────────────────────────────────────────────
const mimeTypes = {
    ".html": "text/html", ".css": "text/css", ".js": "application/javascript",
    ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
    ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml"
}

// ─── Data Setup ─────────────────────────────────────────────────
const dataDir = path.join(__dirname, "data")
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir)
if (!fs.existsSync(path.join(dataDir, "users.json"))) writeJSON(path.join(dataDir, "users.json"), [])
if (!fs.existsSync(path.join(dataDir, "orders.json"))) writeJSON(path.join(dataDir, "orders.json"), [])
if (!fs.existsSync(path.join(dataDir, "products.json"))) {
    writeJSON(path.join(dataDir, "products.json"), [
        { id: 1, name: "Nike Air Max", price: 120, category: "Shoes", image: "https://via.placeholder.com/300x200/6c00ff/ffffff?text=Nike+Air+Max", description: "Premium running shoes with air cushioning for maximum comfort.", rating: 4.5, reviews: [] },
        { id: 2, name: "Leather Jacket", price: 250, category: "Clothing", image: "https://via.placeholder.com/300x200/ff006e/ffffff?text=Leather+Jacket", description: "Stylish genuine leather jacket for all occasions.", rating: 4.2, reviews: [] },
        { id: 3, name: "Smart Watch", price: 199, category: "Electronics", image: "https://via.placeholder.com/300x200/ff9500/ffffff?text=Smart+Watch", description: "Feature-packed smartwatch with health tracking.", rating: 4.7, reviews: [] },
        { id: 4, name: "Backpack", price: 75, category: "Accessories", image: "https://via.placeholder.com/300x200/00c896/ffffff?text=Backpack", description: "Durable travel backpack with multiple compartments.", rating: 4.3, reviews: [] },
        { id: 5, name: "Sunglasses", price: 60, category: "Accessories", image: "https://via.placeholder.com/300x200/6c00ff/ffffff?text=Sunglasses", description: "UV400 protected polarized sunglasses.", rating: 4.0, reviews: [] },
        { id: 6, name: "Headphones", price: 150, category: "Electronics", image: "https://via.placeholder.com/300x200/ff006e/ffffff?text=Headphones", description: "Noise cancelling wireless headphones.", rating: 4.6, reviews: [] },
        { id: 7, name: "Running Shoes", price: 95, category: "Shoes", image: "https://via.placeholder.com/300x200/ff9500/ffffff?text=Running+Shoes", description: "Lightweight running shoes for peak performance.", rating: 4.4, reviews: [] },
        { id: 8, name: "Denim Jeans", price: 80, category: "Clothing", image: "https://via.placeholder.com/300x200/00c896/ffffff?text=Denim+Jeans", description: "Classic slim fit denim jeans.", rating: 4.1, reviews: [] }
    ])
}

// ─── Multer Image Upload Setup ──────────────────────────────────
const uploadsDir = path.join(__dirname, "public", "uploads")
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
        const uniqueName = Date.now() + "_" + file.originalname.replace(/\s+/g, "_")
        cb(null, uniqueName)
    }
})

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"]
        if (allowed.includes(file.mimetype)) cb(null, true)
        else cb(new Error("Only images allowed!"))
    }
})

function parseMultipart(req) {
    return new Promise((resolve, reject) => {
        const mockRes = {
            setHeader: () => {},
            getHeader: () => {},
            end: () => {}
        }
        upload.single("image")(req, mockRes, (err) => {
            if (err) reject(err)
            else resolve(req)
        })
    })
}

// ─── Server ─────────────────────────────────────────────────────
const myserver = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true)
    const pathname = parsedUrl.pathname
    const method = req.method

    // CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*")
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, PUT, OPTIONS")
    res.setHeader("Access-Control-Allow-Headers", "Content-Type")
    if (method === "OPTIONS") { res.writeHead(204); res.end(); return }

    // ─── AUTH ROUTES ───
    // SIGNUP
    if (pathname === "/api/signup" && method === "POST") {
        const body = await getBody(req)
        const { name, email, password } = body
        if (!name || !email || !password) return jsonResponse(res, 400, { success: false, message: "All fields required" })
        const users = readJSON(path.join(dataDir, "users.json"))
        if (users.find(u => u.email === email)) return jsonResponse(res, 400, { success: false, message: "Email already registered" })
        const newUser = { id: Date.now(), name, email, password, avatar: "", wishlist: [], isAdmin: false, createdAt: new Date().toISOString() }
        users.push(newUser)
        writeJSON(path.join(dataDir, "users.json"), users)
        return jsonResponse(res, 201, { success: true, message: "Account created!", user: { id: newUser.id, name, email, avatar: "", wishlist: [], isAdmin: false } })
    }

    // LOGIN
    if (pathname === "/api/login" && method === "POST") {
        const body = await getBody(req)
        const { email, password } = body
        if (!email || !password) return jsonResponse(res, 400, { success: false, message: "All fields required" })
        const users = readJSON(path.join(dataDir, "users.json"))
        const user = users.find(u => u.email === email && u.password === password)
        if (!user) return jsonResponse(res, 401, { success: false, message: "Invalid email or password" })
        return jsonResponse(res, 200, { success: true, message: "Login successful!", user: { id: user.id, name: user.name, email: user.email, avatar: user.avatar || "", wishlist: user.wishlist || [], isAdmin: user.isAdmin || false } })
    }

    // UPDATE PROFILE
    if (pathname === "/api/profile/update" && method === "POST") {
        const body = await getBody(req)
        const { userId, name, email, password, avatar } = body
        const users = readJSON(path.join(dataDir, "users.json"))
        const idx = users.findIndex(u => u.id == userId)
        if (idx === -1) return jsonResponse(res, 404, { success: false, message: "User not found" })
        if (name) users[idx].name = name
        if (email) users[idx].email = email
        if (password) users[idx].password = password
        if (avatar !== undefined) users[idx].avatar = avatar
        writeJSON(path.join(dataDir, "users.json"), users)
        return jsonResponse(res, 200, { success: true, message: "Profile updated!", user: { id: users[idx].id, name: users[idx].name, email: users[idx].email, avatar: users[idx].avatar, wishlist: users[idx].wishlist || [] } })
    }

    // ─── WISHLIST ROUTES ───
    // TOGGLE WISHLIST
    if (pathname === "/api/wishlist/toggle" && method === "POST") {
        const body = await getBody(req)
        const { userId, productId } = body
        const users = readJSON(path.join(dataDir, "users.json"))
        const idx = users.findIndex(u => u.id == userId)
        if (idx === -1) return jsonResponse(res, 404, { success: false, message: "User not found" })
        if (!users[idx].wishlist) users[idx].wishlist = []
        const pIdx = users[idx].wishlist.indexOf(productId)
        if (pIdx === -1) users[idx].wishlist.push(productId)
        else users[idx].wishlist.splice(pIdx, 1)
        writeJSON(path.join(dataDir, "users.json"), users)
        return jsonResponse(res, 200, { success: true, wishlist: users[idx].wishlist })
    }

    // ─── PRODUCT ROUTES ───
    // ADD PRODUCT (Admin)
    if (pathname === "/api/products/add" && method === "POST") {
        const contentType = req.headers["content-type"] || ""
        let name, price, category, image, description

        if (contentType.includes("multipart/form-data")) {
            try {
                await parseMultipart(req)
                const fields = req.body || {}
                name = fields.name
                price = fields.price
                category = fields.category
                description = fields.description
                image = req.file ? `/uploads/${req.file.filename}` : fields.image || ""
            } catch (err) {
                return jsonResponse(res, 400, { success: false, message: err.message })
            }
        } else {
            const body = await getBody(req)
            name = body.name
            price = body.price
            category = body.category
            image = body.image || ""
            description = body.description || ""
        }

        if (!name || !price || !category) return jsonResponse(res, 400, { success: false, message: "Required fields missing" })

        const products = readJSON(path.join(dataDir, "products.json"))
        const newProduct = {
            id: Date.now(),
            name,
            price: parseFloat(price),
            category,
            image: image || `https://via.placeholder.com/300x200?text=${encodeURIComponent(name)}`,
            description: description || "",
            rating: 0,
            reviews: []
        }
        products.push(newProduct)
        writeJSON(path.join(dataDir, "products.json"), products)
        return jsonResponse(res, 201, { success: true, message: "Product added!", product: newProduct })
    }

    // EDIT PRODUCT (Admin)
    if (pathname.startsWith("/api/products/edit/") && method === "POST") {
        const id = parseInt(pathname.split("/")[4])
        const body = await getBody(req)
        const { name, price, category, description } = body
        const products = readJSON(path.join(dataDir, "products.json"))
        const idx = products.findIndex(p => p.id === id)
        if (idx === -1) return jsonResponse(res, 404, { success: false, message: "Product not found" })
        
        if (name) products[idx].name = name
        if (price) products[idx].price = parseFloat(price)
        if (category) products[idx].category = category
        if (description) products[idx].description = description
        
        writeJSON(path.join(dataDir, "products.json"), products)
        return jsonResponse(res, 200, { success: true, message: "Product updated!", product: products[idx] })
    }

    // DELETE PRODUCT (Admin)
    if (pathname.startsWith("/api/products/delete/") && method === "DELETE") {
        const id = parseInt(pathname.split("/")[4])
        const products = readJSON(path.join(dataDir, "products.json"))
        const filtered = products.filter(p => p.id !== id)
        writeJSON(path.join(dataDir, "products.json"), filtered)
        return jsonResponse(res, 200, { success: true, message: "Product deleted!" })
    }

    // ADD REVIEW
    if (pathname.startsWith("/api/products/") && pathname.endsWith("/review") && method === "POST") {
        const id = parseInt(pathname.split("/")[3])
        const body = await getBody(req)
        const { userName, rating, comment } = body
        const products = readJSON(path.join(dataDir, "products.json"))
        const idx = products.findIndex(p => p.id === id)
        if (idx === -1) return jsonResponse(res, 404, { success: false, message: "Product not found" })
        const review = { id: Date.now(), userName, rating: parseFloat(rating), comment, date: new Date().toLocaleDateString() }
        products[idx].reviews.push(review)
        const avgRating = products[idx].reviews.reduce((sum, r) => sum + r.rating, 0) / products[idx].reviews.length
        products[idx].rating = Math.round(avgRating * 10) / 10
        writeJSON(path.join(dataDir, "products.json"), products)
        return jsonResponse(res, 201, { success: true, message: "Review added!", review })
    }

    // GET ALL PRODUCTS
    if (pathname === "/api/products" && method === "GET") {
        const products = readJSON(path.join(dataDir, "products.json"))
        return jsonResponse(res, 200, { success: true, products })
    }

    // GET SINGLE PRODUCT
    if (pathname.startsWith("/api/products/") && method === "GET") {
        const id = parseInt(pathname.split("/")[3])
        const products = readJSON(path.join(dataDir, "products.json"))
        const product = products.find(p => p.id === id)
        if (!product) return jsonResponse(res, 404, { success: false, message: "Product not found" })
        return jsonResponse(res, 200, { success: true, product })
    }

    // ─── ORDER ROUTES ───
    // PLACE ORDER
    if (pathname === "/api/orders/place" && method === "POST") {
        const body = await getBody(req)
        const { userId, userName, items, total, address } = body
        if (!items || !total) return jsonResponse(res, 400, { success: false, message: "Invalid order data" })
        const orders = readJSON(path.join(dataDir, "orders.json"))
        const newOrder = { id: Date.now(), userId, userName, items, total, address, status: "Pending", date: new Date().toLocaleDateString(), time: new Date().toLocaleTimeString() }
        orders.push(newOrder)
        writeJSON(path.join(dataDir, "orders.json"), orders)
        return jsonResponse(res, 201, { success: true, message: "Order placed!", order: newOrder })
    }

    // GET USER ORDERS
    if (pathname.startsWith("/api/orders/user/") && method === "GET") {
        const userId = pathname.split("/")[4]
        const orders = readJSON(path.join(dataDir, "orders.json"))
        const userOrders = orders.filter(o => o.userId == userId)
        return jsonResponse(res, 200, { success: true, orders: userOrders })
    }

    // GET ALL ORDERS (Admin)
    if (pathname === "/api/orders/all" && method === "GET") {
        const orders = readJSON(path.join(dataDir, "orders.json"))
        return jsonResponse(res, 200, { success: true, orders })
    }

    // UPDATE ORDER STATUS (Admin)
    if (pathname.startsWith("/api/orders/status/") && method === "POST") {
        const id = parseInt(pathname.split("/")[4])
        const body = await getBody(req)
        const orders = readJSON(path.join(dataDir, "orders.json"))
        const idx = orders.findIndex(o => o.id === id)
        if (idx === -1) return jsonResponse(res, 404, { success: false, message: "Order not found" })
        orders[idx].status = body.status
        writeJSON(path.join(dataDir, "orders.json"), orders)
        return jsonResponse(res, 200, { success: true, message: "Status updated!" })
    }

    // DELETE ORDER (Admin)
    if (pathname.startsWith("/api/orders/delete/") && method === "DELETE") {
        const id = parseInt(pathname.split("/")[4])
        const orders = readJSON(path.join(dataDir, "orders.json"))
        const filtered = orders.filter(o => o.id !== id)
        writeJSON(path.join(dataDir, "orders.json"), filtered)
        return jsonResponse(res, 200, { success: true, message: "Order deleted!" })
    }

    // ─── USER ROUTES ───
    // GET ALL USERS (Admin)
    if (pathname === "/api/users" && method === "GET") {
        const users = readJSON(path.join(dataDir, "users.json")).map(u => ({ id: u.id, name: u.name, email: u.email, createdAt: u.createdAt }))
        return jsonResponse(res, 200, { success: true, users })
    }

    // DELETE USER (Admin)
    if (pathname.startsWith("/api/users/delete/") && method === "DELETE") {
        const id = parseInt(pathname.split("/")[4])
        const users = readJSON(path.join(dataDir, "users.json"))
        const filtered = users.filter(u => u.id !== id)
        writeJSON(path.join(dataDir, "users.json"), filtered)
        return jsonResponse(res, 200, { success: true, message: "User deleted!" })
    }

    // ─── Page Routes ──────────────────────────────────────────────
    const pages = {
        "/": "index.html", "/index.html": "index.html",
        "/login": "login.html", "/signup": "signup.html",
        "/shop": "shop.html", "/cart": "cart.html",
        "/checkout": "checkout.html", "/profile": "profile.html",
        "/orders": "orders.html", "/product": "product.html",
        "/admin": "admin.html"
    }
    if (pages[pathname]) {
        return serveFile(res, path.join(__dirname, "public", pages[pathname]), "text/html")
    }

    // ── Static Files (images, css, js, uploads) ──────────────────
    const ext = path.extname(pathname)
    if (ext) {
        return serveFile(res, path.join(__dirname, "public", pathname), mimeTypes[ext] || "text/plain")
    }

    res.writeHead(404)
    res.end("Page not found")
})

myserver.listen(2000, () => console.log("🚀 Server running at http://localhost:2000"))