// server.js
const express = require('express');
const session = require('express-session');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const multer = require('multer');

const app = express();
const PORT = 3000;

// --- Middleware ---
app.use(cors({
  origin: 'http://localhost:3000', // Front-end origin
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from "public" and "uploads"
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Session setup
app.use(
  session({
    secret: 'some-random-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 1000 * 60 * 60 * 24 } // 24 hours
  })
);

// Paths to JSON files
const DRINKS_FILE = path.join(__dirname, 'data', 'drinks.json');
const USERS_FILE = path.join(__dirname, 'data', 'users.json');

// Helper functions
function loadDrinks() {
  return JSON.parse(fs.readFileSync(DRINKS_FILE, 'utf-8'));
}
function saveDrinks(data) {
  fs.writeFileSync(DRINKS_FILE, JSON.stringify(data, null, 2));
}
function loadUsers() {
  return JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
}
function saveUsers(data) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2));
}

// --- Multer Setup for Drink Image Uploads ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads'); // Folder for storing images
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + file.originalname;
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });

// ========== ROUTES ==========

// 1) Check session
app.get('/session', (req, res) => {
  if (req.session.user) {
    return res.json({ loggedIn: true, user: req.session.user.username });
  }
  return res.json({ loggedIn: false });
});

// 2) Register (optional)
app.post('/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ message: 'Username and password required.' });
  const users = loadUsers();
  if (users.find(u => u.username === username))
    return res.status(400).json({ message: 'Username already exists.' });
  users.push({ username, password });
  saveUsers(users);
  res.json({ message: 'User registered successfully.' });
});

// 3) Login
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const users = loadUsers();
  const user = users.find(u => u.username === username && u.password === password);
  if (!user)
    return res.status(401).json({ message: 'Invalid credentials.' });
  req.session.user = { username };
  res.json({ message: 'Logged in successfully.', username });
});

// 4) Logout
app.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err)
      return res.status(500).json({ message: 'Error logging out.' });
    res.clearCookie('connect.sid');
    res.json({ message: 'Logged out successfully.' });
  });
});

// 5) Get drinks with average rating (out of 10)
app.get('/drinks', (req, res) => {
  const drinks = loadDrinks();
  const drinksWithAvg = drinks.map(drink => {
    // Ensure each rating has a history array
    drink.ratings = drink.ratings.map(r => {
      if (Array.isArray(r.history)) return r;
      return { username: r.username, history: [{ rating: r.rating, comment: r.comment, timestamp: Date.now() }] };
    });
    let total = 0;
    let count = 0;
    drink.ratings.forEach(r => {
      if (r.history.length > 0) {
        const latest = r.history[r.history.length - 1];
        total += latest.rating;
        count++;
      }
    });
    const avg = count > 0 ? (total / count).toFixed(2) : '0.00';
    return { ...drink, averageRating: avg };
  });
  res.json(drinksWithAvg);
});

// 6) Rate a drink (store rating history)
app.post('/rate', (req, res) => {
  if (!req.session.user)
    return res.status(401).json({ message: 'Not authenticated.' });
  const { drinkId, rating, comment } = req.body;
  if (!drinkId || !rating)
    return res.status(400).json({ message: 'Drink ID and rating required.' });
  const dId = Number(drinkId);
  const drinks = loadDrinks();
  const drink = drinks.find(d => Number(d.id) === dId);
  if (!drink)
    return res.status(404).json({ message: 'Drink not found.' });
  const username = req.session.user.username;
  let userRating = drink.ratings.find(r => r.username === username);
  if (!userRating) {
    userRating = { username, history: [] };
    drink.ratings.push(userRating);
  }
  userRating.history.push({
    rating: Number(rating),
    comment: comment || '',
    timestamp: Date.now()
  });
  saveDrinks(drinks);
  res.json({ message: 'Rating saved successfully.' });
});

// 7) Get current user's ratings (with full history)
app.get('/my-ratings', (req, res) => {
  if (!req.session.user)
    return res.status(401).json({ message: 'Not authenticated.' });
  const username = req.session.user.username;
  const drinks = loadDrinks();
  const userRatings = [];
  drinks.forEach(drink => {
    const r = drink.ratings.find(r => r.username === username);
    if (r) {
      userRatings.push({
        drinkId: drink.id,
        drinkName: drink.name,
        drinkImage: drink.image,
        history: r.history || []
      });
    }
  });
  res.json(userRatings);
});

// 8) Edit a specific comment in the user's rating history
app.put('/edit-comment', (req, res) => {
  if (!req.session.user)
    return res.status(401).json({ message: 'Not authenticated.' });
  const { drinkId, timestamp, newComment, newRating } = req.body;
  const dId = Number(drinkId);
  const drinks = loadDrinks();
  const drink = drinks.find(d => Number(d.id) === dId);
  if (!drink)
    return res.status(404).json({ message: 'Drink not found.' });
  const username = req.session.user.username;
  const userRating = drink.ratings.find(r => r.username === username);
  if (!userRating || !userRating.history)
    return res.status(404).json({ message: 'No rating history found.' });
  const entry = userRating.history.find(h => h.timestamp === Number(timestamp));
  if (!entry)
    return res.status(404).json({ message: 'Review entry not found.' });
  if (newRating) {
    entry.rating = Number(newRating);
  }
  entry.comment = newComment;
  entry.timestamp = Date.now(); // Update timestamp to indicate edit time
  saveDrinks(drinks);
  res.json({ message: 'Review updated successfully.' });
});

// 9) Delete a specific comment/rating entry
app.delete('/delete-comment', (req, res) => {
  if (!req.session.user)
    return res.status(401).json({ message: 'Not authenticated.' });
  const { drinkId, timestamp } = req.body;
  const dId = Number(drinkId);
  const drinks = loadDrinks();
  const drink = drinks.find(d => Number(d.id) === dId);
  if (!drink)
    return res.status(404).json({ message: 'Drink not found.' });
  const username = req.session.user.username;
  const userRating = drink.ratings.find(r => r.username === username);
  if (!userRating || !userRating.history)
    return res.status(404).json({ message: 'No rating history found.' });
  const index = userRating.history.findIndex(h => h.timestamp === Number(timestamp));
  if (index === -1)
    return res.status(404).json({ message: 'Review entry not found.' });
  // Remove the review entry
  userRating.history.splice(index, 1);
  
  // If the user's rating history is now empty, remove the entire rating object
  if (userRating.history.length === 0) {
    const ratingIndex = drink.ratings.findIndex(r => r.username === username);
    if (ratingIndex !== -1) {
      drink.ratings.splice(ratingIndex, 1);
    }
  }
  
  saveDrinks(drinks);
  res.json({ message: 'Review entry deleted successfully.' });
});

// 10) Admin: Add a new drink (only accessible if user is "dominick")
app.post('/add-drink', upload.single('drinkImage'), (req, res) => {
  if (!req.session.user || req.session.user.username !== 'dominick') {
    return res.status(403).json({ message: 'Access denied. Admins only.' });
  }
  if (!req.file) {
    return res.status(400).json({ message: 'Drink image file is required.' });
  }
  const imagePath = path.join('uploads', req.file.filename);
  const { name, description, caffeine } = req.body;
  if (!name || !description || caffeine === undefined) {
    return res.status(400).json({ message: 'Name, description, and caffeine content are required.' });
  }
  const drinks = loadDrinks();
  const newId = drinks.reduce((max, drink) => Math.max(max, Number(drink.id)), 0) + 1;
  const newDrink = {
    id: newId,
    image: imagePath,
    name,
    description,
    caffeine: Number(caffeine),
    ratings: []
  };
  drinks.push(newDrink);
  saveDrinks(drinks);
  res.json({ message: 'New drink added successfully.', drink: newDrink });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
