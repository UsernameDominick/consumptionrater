// script.js

// 1) Imports from Firebase
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-analytics.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { 
  getFirestore,
  collection,
  addDoc,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// 2) Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyCWDCdWc2kXGmzzrQYwykwwg57JSuMayXs",
  authDomain: "consumption-rater.firebaseapp.com",
  projectId: "consumption-rater",
  storageBucket: "consumption-rater.firebasestorage.app",
  messagingSenderId: "328999413075",
  appId: "1:328999413075:web:511721bdc80015c7ededa6",
  measurementId: "G-S1KWPEVX6Y"
};

// 3) Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);

// 4) Global Variables
let currentUser = null;
let drinksData = [];
let currentDrink = null;
let currentRatingValue = 0;

// 5) DOM Elements
const profileIcon = document.getElementById('profile-icon');
const profileUsername = document.getElementById('profile-username');

const loginModal = document.getElementById('login-modal');
const closeLoginModalBtn = document.getElementById('close-login-modal');
const loginUsername = document.getElementById('login-username');
const loginPassword = document.getElementById('login-password');
const loginSubmitBtn = document.getElementById('login-submit');
const loginError = document.getElementById('login-error');

const profileModal = document.getElementById('profile-modal');
const closeProfileModalBtn = document.getElementById('close-profile-modal');
const welcomeMsg = document.getElementById('welcome-msg');
const profileStats = document.getElementById('profile-stats');
const myRatingsList = document.getElementById('my-ratings-list');
const logoutBtn = document.getElementById('logout-btn');
const profileSearch = document.getElementById('profile-search');

const drinkPopup = document.getElementById('drink-popup');
const closeDrinkPopupBtn = document.getElementById('close-drink-popup');
const drinkNameElem = document.getElementById('drink-name');
const drinkImageElem = document.getElementById('drink-image');
const drinkDescElem = document.getElementById('drink-description');
const avgRatingElem = document.getElementById('average-rating');
const reviewsList = document.getElementById('reviews-list');
const starRatingContainer = document.getElementById('star-rating');
const commentInput = document.getElementById('comment-input');
const saveRatingBtn = document.getElementById('save-rating-btn');

// Edit modal elements (for editing a review)
const editCommentModal = document.getElementById('edit-comment-modal');
const closeEditCommentModalBtn = document.getElementById('close-edit-comment-modal');
const editCommentDesc = document.getElementById('edit-comment-desc');  // Holds dataset.drinkId & dataset.reviewId
const editCommentText = document.getElementById('edit-comment-text');
const saveEditCommentBtn = document.getElementById('save-edit-comment-btn');
const editStarRatingContainer = document.getElementById('edit-star-rating');

// Main page search/filter
const searchInput = document.getElementById('search-input');
const filterSelect = document.getElementById('filter-select');
const drinksContainer = document.getElementById('drinks-container');

// -----------------------
//   ON PAGE LOAD
// -----------------------
document.addEventListener('DOMContentLoaded', () => {
  // Check if user info is saved in localStorage
  const savedUser = localStorage.getItem('loggedInUser');
  if (savedUser) {
    currentUser = savedUser;
    profileUsername.classList.remove('hidden');
    profileUsername.textContent = currentUser;
  }
  
  fetchDrinks();

  // Profile icon click
  profileIcon.addEventListener('click', () => {
    if (!currentUser) {
      openModal(loginModal);
    } else {
      openProfileModal();
    }
  });

  closeLoginModalBtn.addEventListener('click', () => openModal(loginModal, false));
  loginSubmitBtn.addEventListener('click', handleLogin);

  closeProfileModalBtn.addEventListener('click', () => openModal(profileModal, false));
  logoutBtn.addEventListener('click', handleLogout);

  closeDrinkPopupBtn.addEventListener('click', () => openModal(drinkPopup, false));
  saveRatingBtn.addEventListener('click', saveRating);

  closeEditCommentModalBtn.addEventListener('click', () => openModal(editCommentModal, false));
  saveEditCommentBtn.addEventListener('click', saveEditedComment);

  profileSearch.addEventListener('input', filterProfileRatings);
  searchInput.addEventListener('input', renderDrinks);
  filterSelect.addEventListener('change', renderDrinks);
});

// -----------------------
//   MODAL UTILITY
// -----------------------
function openModal(modal, show = true) {
  modal.style.display = show ? 'block' : 'none';
}

// -----------------------
//   LOGIN / LOGOUT
// -----------------------
async function handleLogin() {
  const usernameVal = loginUsername.value.trim();
  const passwordVal = loginPassword.value.trim();
  try {
    // Use the username as the doc ID in "users"
    const userDocRef = doc(db, "users", usernameVal);
    const userDoc = await getDoc(userDocRef);
    if (!userDoc.exists()) {
      loginError.textContent = "User not found";
      return;
    }
    const userData = userDoc.data();
    if (userData.password !== passwordVal) {
      loginError.textContent = "Invalid credentials";
      return;
    }
    // Success
    currentUser = usernameVal;
    localStorage.setItem('loggedInUser', currentUser);  // Save login to localStorage
    profileUsername.classList.remove('hidden');
    profileUsername.textContent = currentUser;
    loginError.textContent = "";
    openModal(loginModal, false);
  } catch (error) {
    console.error("Login error", error);
    loginError.textContent = "Error during login";
  }
}

function handleLogout() {
  localStorage.removeItem('loggedInUser'); // Remove login from localStorage
  currentUser = null;
  profileUsername.classList.add('hidden');
  profileUsername.textContent = '';
  openModal(profileModal, false);
}

// -----------------------
//   FETCH DRINKS + REVIEWS
// -----------------------
async function fetchDrinks() {
  try {
    const drinksSnapshot = await getDocs(collection(db, "drinks"));
    // For each drink, fetch its "reviews" subcollection
    drinksData = await Promise.all(
      drinksSnapshot.docs.map(async drinkDoc => {
        let drink = { id: drinkDoc.id, ...drinkDoc.data() };
        const reviewsSnapshot = await getDocs(collection(db, "drinks", drinkDoc.id, "reviews"));
        drink.ratings = reviewsSnapshot.docs.map(reviewDoc => ({
          id: reviewDoc.id,
          ...reviewDoc.data()
        }));
        // Calculate average rating
        let sum = 0;
        drink.ratings.forEach(r => { sum += r.rating; });
        const avg = drink.ratings.length > 0 ? (sum / drink.ratings.length).toFixed(2) : 0;
        drink.averageRating = avg;
        return drink;
      })
    );
    console.log("Fetched drinks with reviews:", drinksData);
    renderDrinks();
  } catch (error) {
    console.error("Error fetching drinks:", error);
  }
}

// -----------------------
//   RENDER DRINKS
// -----------------------
function renderDrinks() {
  const searchVal = searchInput.value.toLowerCase();
  let filtered = drinksData.filter(d => {
    const title = (d.name || d.drinkName || "").toLowerCase();
    return title.includes(searchVal);
  });

  const filterVal = filterSelect.value;
  if (filterVal === 'highest-rating') {
    filtered.sort((a, b) => parseFloat(b.averageRating) - parseFloat(a.averageRating));
  } else if (filterVal === 'lowest-rating') {
    filtered.sort((a, b) => parseFloat(a.averageRating) - parseFloat(b.averageRating));
  }

  drinksContainer.innerHTML = '';
  filtered.forEach(drink => {
    const card = document.createElement('div');
    card.classList.add('drink-card');

    const img = document.createElement('img');
    img.src = (drink.image || "").replace(/"/g, '');
    img.alt = drink.name || drink.drinkName;

    const name = document.createElement('h3');
    name.classList.add('drink-name');
    name.textContent = drink.name || drink.drinkName;

    const avgRatingDiv = document.createElement('div');
    avgRatingDiv.classList.add('average-rating');
    avgRatingDiv.textContent = `Avg Rating: ${drink.averageRating || "N/A"}`;

    card.appendChild(img);
    card.appendChild(name);
    card.appendChild(avgRatingDiv);
    card.addEventListener('click', () => openDrinkPopup(drink));
    drinksContainer.appendChild(card);
  });
}

// -----------------------
//   PROFILE MODAL
// -----------------------
function openProfileModal() {
  if (!currentUser) return;
  welcomeMsg.textContent = `Welcome, ${currentUser}!`;

  // Gather user reviews from drinksData
  const userReviews = [];
  drinksData.forEach(drink => {
    const userRating = drink.ratings.find(r => r.username === currentUser);
    if (userRating) {
      userReviews.push({
        drinkId: drink.id,
        drinkName: drink.name,
        reviewId: userRating.id,
        rating: userRating.rating,
        comment: userRating.comment
      });
    }
  });

  renderProfileRatings(userReviews);
  openModal(profileModal);
}

function renderProfileRatings(ratings) {
  myRatingsList.innerHTML = '';

  if (ratings.length === 0) {
    myRatingsList.innerHTML = '<p>You have not rated any drinks yet.</p>';
    profileStats.textContent = '';
    return;
  }

  let total = ratings.length;
  let sum = 0;
  ratings.forEach(r => { sum += r.rating; });
  let avg = (sum / total).toFixed(2);
  profileStats.textContent = `You have rated ${total} drink(s). Your average rating is ${avg}/10.`;

  ratings.forEach(r => {
    const container = document.createElement('div');
    container.classList.add('rating-item');
    container.innerHTML = `
      <div style="display:flex; gap:1rem; align-items:center;">
        <div style="flex:1;">
          <h3 style="margin-bottom:0.2rem;">${r.drinkName}</h3>
          <div class="rating-info">
            <strong>Rating:</strong> ${r.rating}/10<br/>
            <strong>Comment:</strong><br/>
            <p class="comment-text">${r.comment || ''}</p>
          </div>
          <div class="btn-group">
            <button class="modern-btn" onclick="openEditModal('${r.drinkId}','${r.reviewId}', ${r.rating}, '${r.comment}')">Edit</button>
            <button class="modern-btn delete-btn" onclick="deleteReview('${r.drinkId}','${r.reviewId}')">Delete</button>
          </div>
        </div>
      </div>
    `;
    myRatingsList.appendChild(container);
  });
}

function filterProfileRatings() {
  const term = profileSearch.value.toLowerCase();
  const items = myRatingsList.querySelectorAll('.rating-item');
  items.forEach(item => {
    const name = item.querySelector('h3').textContent.toLowerCase();
    item.style.display = name.includes(term) ? '' : 'none';
  });
}

// -----------------------
//   DRINK POPUP & RATING
// -----------------------
function openDrinkPopup(drink) {
  currentDrink = drink;
  currentRatingValue = 0;

  drinkNameElem.textContent = drink.name || drink.drinkName;
  drinkImageElem.src = (drink.image || "").replace(/"/g, '');
  drinkDescElem.textContent = drink.description || '';
  avgRatingElem.textContent = drink.averageRating || '0';

  renderAllReviews(drink);

  const userRating = drink.ratings.find(r => r.username === currentUser);
  if (userRating) {
    currentRatingValue = userRating.rating;
    commentInput.value = userRating.comment || '';
    commentInput.style.display = "none";
    starRatingContainer.style.display = "none";
    saveRatingBtn.style.display = "none";
  } else {
    currentRatingValue = 0;
    commentInput.value = '';
    commentInput.style.display = "block";
    starRatingContainer.style.display = "block";
    saveRatingBtn.style.display = "inline-block";
  }
  renderStarRating(currentRatingValue);

  openModal(drinkPopup);
}

function renderAllReviews(drink) {
  reviewsList.innerHTML = '';
  if (!drink.ratings || drink.ratings.length === 0) {
    return;
  }
  drink.ratings.forEach(r => {
    const li = document.createElement('li');

    const usernameDiv = document.createElement('div');
    usernameDiv.innerHTML = `<h3>${r.username}</h3>`;
    li.appendChild(usernameDiv);

    const ratingDiv = document.createElement('div');
    ratingDiv.innerHTML = `${ratingToStars(r.rating)} (${r.rating}/10)`;
    li.appendChild(ratingDiv);

    if (r.comment) {
      const commentP = document.createElement('p');
      commentP.textContent = r.comment;
      li.appendChild(commentP);
    }

    reviewsList.appendChild(li);
  });
}

function ratingToStars(rating) {
  const starRating = Math.round(rating);
  let stars = '';
  for (let i = 0; i < starRating; i++) {
    stars += '★';
  }
  for (let i = starRating; i < 10; i++) {
    stars += '☆';
  }
  return stars;
}

function renderStarRating(userRating) {
  starRatingContainer.innerHTML = '';
  if (!currentUser) {
    starRatingContainer.textContent = 'Log in to rate.';
    return;
  }
  for (let i = 1; i <= 10; i++) {
    const star = document.createElement('span');
    star.classList.add('star');
    star.innerHTML = '&#9733;';
    if (i <= userRating) {
      star.classList.add('selected');
    }
    star.addEventListener('mouseover', () => highlightStars(i));
    star.addEventListener('mouseout', () => highlightStars(currentRatingValue));
    star.addEventListener('click', () => {
      currentRatingValue = i;
      highlightStars(i);
    });
    starRatingContainer.appendChild(star);
  }
}

function highlightStars(count) {
  const stars = starRatingContainer.querySelectorAll('.star');
  stars.forEach((star, idx) => {
    star.classList.toggle('hovered', idx < count);
  });
}

// -----------------------
//   SAVE RATING
// -----------------------
async function saveRating() {
  if (!currentUser || !currentDrink) return;
  try {
    const ratingVal = currentRatingValue;
    const commentVal = commentInput.value.trim();

    const newReviewRef = await addDoc(collection(db, "drinks", currentDrink.id.toString(), "reviews"), {
      username: currentUser,
      rating: ratingVal,
      comment: commentVal,
      timestamp: serverTimestamp()
    });
    console.log("Rating saved in Firestore with ID:", newReviewRef.id);

    // Refresh drinks and re-render (no modal for profile change here)
    await fetchDrinks();
    openModal(drinkPopup, false);
  } catch (error) {
    console.error("Error saving rating:", error);
  }
}

// -----------------------
//   EDIT/DELETE REVIEWS
// -----------------------
function openEditModal(drinkId, reviewId, currentRating, currentComment) {
  editCommentDesc.dataset.drinkId = drinkId;
  editCommentDesc.dataset.reviewId = reviewId;
  renderEditStarRating(currentRating);
  editCommentText.value = currentComment;
  openModal(editCommentModal);
}

function renderEditStarRating(currentRating) {
  editStarRatingContainer.innerHTML = '';
  for (let i = 1; i <= 10; i++) {
    const star = document.createElement('span');
    star.classList.add('star');
    star.innerHTML = '★';
    if (i <= currentRating) {
      star.classList.add('selected');
    }
    star.addEventListener('click', () => {
      currentRating = i;
      renderEditStarRating(i);
    });
    editStarRatingContainer.appendChild(star);
  }
  return currentRating;
}

async function saveEditedComment() {
  const drinkId = editCommentDesc.dataset.drinkId;
  const reviewId = editCommentDesc.dataset.reviewId;
  const newComment = editCommentText.value.trim();
  const newRating = Array.from(editStarRatingContainer.querySelectorAll('.star'))
    .filter(star => star.classList.contains('selected')).length;
  try {
    await updateDoc(doc(db, "drinks", drinkId.toString(), "reviews", reviewId), {
      comment: newComment,
      rating: newRating,
      timestamp: serverTimestamp()
    });
    console.log("Review updated in Firestore");
    openModal(editCommentModal, false);
    await fetchDrinks();
    openProfileModal();
  } catch (error) {
    console.error("Error editing review:", error);
  }
}

async function deleteReview(drinkId, reviewId) {
  if (!confirm('Are you sure you want to delete this review?')) return;
  try {
    await deleteDoc(doc(db, "drinks", drinkId.toString(), "reviews", reviewId));
    console.log("Review deleted from Firestore");
    await fetchDrinks();
    openProfileModal();
  } catch (error) {
    console.error("Error deleting review:", error);
  }
}

// Expose functions globally so inline onclick handlers can find them
window.openEditModal = openEditModal;
window.deleteReview = deleteReview;
