// script.js

let currentUser = null;
let drinksData = [];
let currentDrink = null;
let currentRatingValue = 0;

// DOM elements for general functionality
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
const profileSearch = document.getElementById('profile-search'); // For filtering reviews

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

// Edit review modal elements
const editCommentModal = document.getElementById('edit-comment-modal');
const closeEditCommentModalBtn = document.getElementById('close-edit-comment-modal');
const editCommentDesc = document.getElementById('edit-comment-desc');
const editCommentTimestamp = document.getElementById('edit-comment-timestamp');
const editCommentText = document.getElementById('edit-comment-text');
const saveEditCommentBtn = document.getElementById('save-edit-comment-btn');
const editStarRatingContainer = document.getElementById('edit-star-rating');

// Main page search and filter elements
const searchInput = document.getElementById('search-input');
const filterSelect = document.getElementById('filter-select');
const drinksContainer = document.getElementById('drinks-container');

document.addEventListener('DOMContentLoaded', () => {
  checkSession().then(() => {
    fetchDrinks();
  });

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

// Modal utility: openModal(modal, show = true)
function openModal(modal, show = true) {
  modal.style.display = show ? 'block' : 'none';
}

// SESSION
function checkSession() {
  return fetch('/session', { credentials: 'include' })
    .then(res => res.json())
    .then(data => {
      if (data.loggedIn) {
        currentUser = data.user;
        profileUsername.classList.remove('hidden');
        profileUsername.textContent = currentUser;
      } else {
        currentUser = null;
        profileUsername.classList.add('hidden');
        profileUsername.textContent = '';
      }
    })
    .catch(err => console.error(err));
}

// FETCH DRINKS
function fetchDrinks() {
  fetch('/drinks', { credentials: 'include' })
    .then(res => res.json())
    .then(data => {
      drinksData = data;
      console.log("Fetched drinks:", drinksData);
      renderDrinks();
    })
    .catch(err => console.error(err));
}

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
    img.src = drink.image;
    img.alt = drink.name || drink.drinkName;
    const name = document.createElement('h3');
    name.classList.add('drink-name');
    name.textContent = drink.name || drink.drinkName;
    const avgRatingDiv = document.createElement('div');
    avgRatingDiv.classList.add('average-rating');
    avgRatingDiv.textContent = `Avg Rating: ${drink.averageRating}`;
    card.appendChild(img);
    card.appendChild(name);
    card.appendChild(avgRatingDiv);
    card.addEventListener('click', () => openDrinkPopup(drink));
    drinksContainer.appendChild(card);
  });
}

// LOGIN/LOGOUT
function handleLogin() {
  const usernameVal = loginUsername.value.trim();
  const passwordVal = loginPassword.value.trim();
  fetch('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ username: usernameVal, password: passwordVal })
  })
    .then(res => {
      if (!res.ok) return res.json().then(d => Promise.reject(d));
      return res.json();
    })
    .then(data => {
      currentUser = data.username;
      loginError.textContent = '';
      profileUsername.classList.remove('hidden');
      profileUsername.textContent = currentUser;
      openModal(loginModal, false);
    })
    .catch(err => {
      loginError.textContent = err.message || 'Invalid credentials.';
    });
}

function handleLogout() {
  fetch('/logout', { method: 'POST', credentials: 'include' })
    .then(res => res.json())
    .then(() => {
      currentUser = null;
      profileUsername.classList.add('hidden');
      profileUsername.textContent = '';
      openModal(profileModal, false);
    })
    .catch(err => console.error(err));
}

// PROFILE MODAL
function openProfileModal() {
  if (!currentUser) return;
  welcomeMsg.textContent = `Welcome, ${currentUser}!`;
  fetch('/my-ratings', { credentials: 'include' })
    .then(res => res.json())
    .then(data => {
      if (data.message === 'Not authenticated.') return;
      renderProfileRatings(data);
      let total = 0, sum = 0;
      data.forEach(d => {
        if (d.history && d.history.length > 0) {
          const last = d.history[d.history.length - 1];
          sum += last.rating;
          total++;
        }
      });
      const avg = total > 0 ? (sum / total).toFixed(2) : 0;
      profileStats.textContent = `You have rated ${total} drink(s). Your average rating is ${avg}/10.`;
      openModal(profileModal);
    })
    .catch(err => {
      console.error(err);
      openModal(profileModal);
    });
}

function renderProfileRatings(ratings) {
  myRatingsList.innerHTML = '';
  // Filter out entries with an empty history
  const filteredRatings = ratings.filter(d => d.history && d.history.length > 0);
  
  if (filteredRatings.length === 0) {
    myRatingsList.innerHTML = '<p>You have not rated any drinks yet.</p>';
    return;
  }
  filteredRatings.forEach(d => {
    const container = document.createElement('div');
    container.classList.add('rating-item');
    const lines = (d.history || []).map(h => {
      return `
        <div class="rating-entry">
          <div class="rating-info">
            <strong>Rating:</strong> ${h.rating}/10<br/>
            <strong>Comment:</strong><br/>
            <p class="comment-text">${h.comment || ''}</p>
          </div>
          <div class="btn-group">
            <button class="modern-btn" onclick="openEditModal('${d.drinkId}','${h.timestamp}', ${h.rating}, '${h.comment}')">Edit</button>
            <button class="modern-btn delete-btn" onclick="deleteComment('${d.drinkId}','${h.timestamp}')">Delete</button>
          </div>
        </div>
      `;
    }).join('');
    container.innerHTML = `
      <div style="display:flex; gap:1rem; align-items:center;">
        <div style="flex:1;">
          <h3 style="margin-bottom:0.2rem;">${d.drinkName}</h3>
          ${lines}
        </div>
      </div>
    `;
    myRatingsList.appendChild(container);
  });
}

// Filter ratings in profile modal based on search input
function filterProfileRatings() {
  const term = profileSearch.value.toLowerCase();
  const items = myRatingsList.querySelectorAll('.rating-item');
  items.forEach(item => {
    const name = item.querySelector('h3').textContent.toLowerCase();
    item.style.display = name.includes(term) ? '' : 'none';
  });
}

// EDIT/DELETE COMMENTS
function openEditModal(drinkId, timestamp, currentRating, currentComment) {
  editCommentDesc.dataset.drinkId = drinkId;
  editCommentDesc.dataset.timestamp = timestamp; // Save the timestamp for the edit
  renderEditStarRating(currentRating);
  editCommentText.value = currentComment;
  openModal(editCommentModal);
}

function renderEditStarRating(currentRating) {
  editStarRatingContainer.innerHTML = '';
  for (let i = 1; i <= 10; i++) {
    const star = document.createElement('span');
    star.classList.add('star');
    star.innerHTML = '&#9733;';
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

function saveEditedComment() {
  const drinkId = editCommentDesc.dataset.drinkId;
  const timestamp = parseInt(editCommentDesc.dataset.timestamp, 10);
  const newComment = editCommentText.value.trim();
  const newRating = Array.from(editStarRatingContainer.querySelectorAll('.star'))
    .filter(star => star.classList.contains('selected')).length;
  fetch('/edit-comment', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ drinkId, timestamp, newComment, newRating })
  })
    .then(res => res.json())
    .then(data => {
      console.log(data);
      openModal(editCommentModal, false);
      fetchDrinks();
      openProfileModal();
    })
    .catch(err => console.error(err));
}

function deleteComment(drinkId, timestamp) {
  if (!confirm('Are you sure you want to delete this comment/rating entry?')) return;
  fetch('/delete-comment', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ drinkId, timestamp: parseInt(timestamp, 10) })
  })
    .then(res => res.json())
    .then(data => {
      console.log(data);
      fetchDrinks();
      openProfileModal();
    })
    .catch(err => console.error(err));
}

// DRINK POPUP & RATING (1-10)
function openDrinkPopup(drink) {
  currentDrink = drink;
  currentRatingValue = 0;
  drinkNameElem.textContent = drink.name || drink.drinkName;
  drinkImageElem.src = drink.image;
  drinkDescElem.textContent = drink.description;
  avgRatingElem.textContent = drink.averageRating || '0';
  renderAllReviews(drink);
  let hasReviewed = false;
  if (currentUser && drink.ratings) {
    const userRating = drink.ratings.find(r => r.username === currentUser);
    if (userRating && userRating.history && userRating.history.length > 0) {
      const latest = userRating.history[userRating.history.length - 1];
      currentRatingValue = latest.rating;
      commentInput.value = latest.comment;
      hasReviewed = true;
    }
  }
  renderStarRating(currentRatingValue);
  if (hasReviewed) {
    commentInput.style.display = "none";
    starRatingContainer.style.display = "none";
    saveRatingBtn.style.display = "none";
  } else {
    commentInput.style.display = "block";
    starRatingContainer.style.display = "block";
    saveRatingBtn.style.display = "inline-block";
  }
  openModal(drinkPopup);
}

// Helper: Convert a 10-scale rating to a 10-star string
function ratingToStars(rating) {
  const starRating = Math.round(rating / 1);
  let stars = '';
  for (let i = 0; i < starRating; i++) {
    stars += '★';
  }
  for (let i = starRating; i < 10; i++) {
    stars += '☆';
  }
  return stars;
}

function renderAllReviews(drink) {
  reviewsList.innerHTML = '';
  if (!drink.ratings || drink.ratings.length === 0) {
    return;
  }
  drink.ratings.forEach(r => {
    if (r.history && r.history.length > 0) {
      const latest = r.history[r.history.length - 1];
      const li = document.createElement('li');
      
      // Create an element for the username
      const usernameDiv = document.createElement('div');
      usernameDiv.innerHTML = `<h3>${r.username}</h3>`;
      li.appendChild(usernameDiv);
      
      // Create an element for the rating (converted to stars) underneath the username
      const ratingDiv = document.createElement('div');
      ratingDiv.innerHTML = `${ratingToStars(latest.rating)} (${latest.rating}/10)`;
      li.appendChild(ratingDiv);
      
      // Create a separate paragraph for the comment
      if (latest.comment) {
        const commentP = document.createElement('p');
        commentP.textContent = latest.comment;
        li.appendChild(commentP);
      }
      
      reviewsList.appendChild(li);
    }
  });
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

function saveRating() {
  if (!currentUser || !currentDrink) return;
  const ratingVal = currentRatingValue;
  const commentVal = commentInput.value.trim();
  fetch('/rate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      drinkId: currentDrink.id,
      rating: ratingVal,
      comment: commentVal
    })
  })
    .then(res => res.json())
    .then(data => {
      console.log(data);
      fetchDrinks();
      const userRating = currentDrink.ratings.find(r => r.username === currentUser);
      if (!userRating) {
        currentDrink.ratings.push({ 
          username: currentUser, 
          history: [{ rating: ratingVal, comment: commentVal, timestamp: Date.now() }] 
        });
      } else {
        userRating.history.push({ rating: ratingVal, comment: commentVal, timestamp: Date.now() });
      }
      renderAllReviews(currentDrink);
      commentInput.style.display = "none";
      starRatingContainer.style.display = "none";
      saveRatingBtn.style.display = "none";
    })
    .catch(err => console.error(err));
}
