// App State Management
class AppState {
    constructor() {
        this.currentScreen = 'loading';
        this.user = null;
        this.token = localStorage.getItem('token');
        this.currentMatch = null;
        this.matches = [];
        this.potentialMatches = [];
        this.currentChatId = null;
        this.socket = null;
    }

    setUser(user) {
        this.user = user;
    }

    setToken(token) {
        this.token = token;
        if (token) {
            localStorage.setItem('token', token);
        } else {
            localStorage.removeItem('token');
        }
    }

    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        document.getElementById(screenId).classList.add('active');
        this.currentScreen = screenId;
    }

    showTab(tabId) {
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelectorAll('.nav-item').forEach(nav => {
            nav.classList.remove('active');
        });
        
        document.getElementById(tabId + '-tab').classList.add('active');
        document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
    }
}

// API Service
class ApiService {
    constructor() {
        this.baseURL = '/api';
    }

    async request(endpoint, options = {}) {
        const url = this.baseURL + endpoint;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        if (appState.token && !config.headers.Authorization) {
            config.headers.Authorization = `Bearer ${appState.token}`;
        }

        try {
            const response = await fetch(url, config);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Request failed');
            }

            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    // Auth endpoints
    async register(userData) {
        return this.request('/auth/register', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
    }

    async login(credentials) {
        return this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify(credentials)
        });
    }

    async getCurrentUser() {
        return this.request('/auth/me');
    }

    async logout() {
        return this.request('/auth/logout', { method: 'POST' });
    }

    // Profile endpoints
    async updateProfile(profileData) {
        return this.request('/profile/update', {
            method: 'PUT',
            body: JSON.stringify(profileData)
        });
    }

    async uploadPhotos(formData) {
        return this.request('/profile/upload-photos', {
            method: 'POST',
            headers: {},
            body: formData
        });
    }

    async updateLocation(latitude, longitude) {
        return this.request('/profile/update-location', {
            method: 'PUT',
            body: JSON.stringify({ latitude, longitude })
        });
    }

    // Match endpoints
    async getPotentialMatches() {
        return this.request('/match/potential');
    }

    async likeUser(userId) {
        return this.request(`/match/like/${userId}`, { method: 'POST' });
    }

    async dislikeUser(userId) {
        return this.request(`/match/dislike/${userId}`, { method: 'POST' });
    }

    async getMatches() {
        return this.request('/match/matches');
    }

    // Chat endpoints
    async getChats() {
        return this.request('/chat');
    }

    async getChatWithUser(userId) {
        return this.request(`/chat/with/${userId}`);
    }

    async sendMessage(chatId, content) {
        return this.request(`/chat/${chatId}/messages`, {
            method: 'POST',
            body: JSON.stringify({ content })
        });
    }

    async getMessages(chatId) {
        return this.request(`/chat/${chatId}/messages`);
    }
}

// Initialize app state and API service
const appState = new AppState();
const api = new ApiService();

// Socket.IO connection
function initializeSocket() {
    appState.socket = io();
    
    appState.socket.on('connect', () => {
        console.log('Connected to server');
    });

    appState.socket.on('receive-message', (data) => {
        if (data.chatId === appState.currentChatId) {
            displayMessage(data.message);
        }
    });
}

// Utility Functions
function showError(message) {
    // Create or update error display
    let errorDiv = document.getElementById('error-message');
    if (!errorDiv) {
        errorDiv = document.createElement('div');
        errorDiv.id = 'error-message';
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #ff4757;
            color: white;
            padding: 15px 20px;
            border-radius: 10px;
            z-index: 3000;
            box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        `;
        document.body.appendChild(errorDiv);
    }
    
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    
    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 5000);
}

function showSuccess(message) {
    let successDiv = document.getElementById('success-message');
    if (!successDiv) {
        successDiv = document.createElement('div');
        successDiv.id = 'success-message';
        successDiv.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #2ed573;
            color: white;
            padding: 15px 20px;
            border-radius: 10px;
            z-index: 3000;
            box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        `;
        document.body.appendChild(successDiv);
    }
    
    successDiv.textContent = message;
    successDiv.style.display = 'block';
    
    setTimeout(() => {
        successDiv.style.display = 'none';
    }, 3000);
}

function validateEmail(email) {
    const universityDomains = ['.edu', '.ac.uk', '.edu.au', '.ac.in'];
    return universityDomains.some(domain => email.toLowerCase().includes(domain));
}

// Authentication Functions
async function handleLogin(event) {
    event.preventDefault();
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
        const response = await api.login({ email, password });
        appState.setToken(response.token);
        appState.setUser(response.user);
        
        if (response.user.profileCompleted) {
            appState.showScreen('main-app-screen');
            await loadPotentialMatches();
        } else {
            appState.showScreen('profile-setup-screen');
        }
        
        initializeSocket();
        showSuccess('Welcome back!');
    } catch (error) {
        showError(error.message);
    }
}

async function handleSignup(event) {
    event.preventDefault();
    
    const formData = {
        firstName: document.getElementById('signup-firstname').value,
        lastName: document.getElementById('signup-lastname').value,
        email: document.getElementById('signup-email').value,
        password: document.getElementById('signup-password').value,
        age: parseInt(document.getElementById('signup-age').value),
        gender: document.getElementById('signup-gender').value,
        interestedIn: document.getElementById('signup-interested').value
    };

    if (!validateEmail(formData.email)) {
        showError('Please use a valid university email address');
        return;
    }

    try {
        await api.register(formData);
        showSuccess('Registration successful! Please check your email to verify your account.');
        appState.showScreen('login-screen');
    } catch (error) {
        showError(error.message);
    }
}

// Profile Setup Functions
async function handleProfileSetup(e) {
    e.preventDefault();
    
    // Validate required fields
    const course = document.getElementById('setup-course').value.trim();
    const bio = document.getElementById('setup-bio').value.trim();
    
    if (!course) {
        showError('Please enter your course/major.');
        return;
    }
    
    if (!bio) {
        showError('Please write something about yourself.');
        return;
    }
    
    // Check if at least one photo is uploaded
    const photoSlotsWithPhotos = document.querySelectorAll('.photo-slot[data-has-photo="true"]');
    if (photoSlotsWithPhotos.length === 0) {
        showError('Please upload at least one photo.');
        return;
    }
    
    const profileData = {
        course: course,
        year: document.getElementById('setup-year').value ? parseInt(document.getElementById('setup-year').value) : undefined,
        bio: bio
    };

    try {
        await api.updateProfile(profileData);
        
        // Upload photos if any
        const photoInputs = document.querySelectorAll('[id^="photo-input-"]');
        const allFiles = [];
        
        photoInputs.forEach(input => {
            if (input && input.files && input.files.length > 0) {
                Array.from(input.files).forEach(file => {
                    allFiles.push(file);
                });
            }
        });
        
        if (allFiles.length > 0) {
            const formData = new FormData();
            allFiles.forEach(file => {
                formData.append('photos', file);
            });
            await api.uploadPhotos(formData);
        }

        // Check if profile is actually complete before proceeding
        const updatedUser = await api.getCurrentUser();
        appState.setUser(updatedUser.user);
        
        if (updatedUser.user.profileCompleted) {
            showSuccess('Profile completed successfully!');
            appState.showScreen('main-app-screen');
            await loadPotentialMatches();
        } else {
            showError('Please complete all required fields including at least one photo to continue.');
        }
    } catch (error) {
        showError(error.message);
    }
}

function handlePhotoUpload(event) {
    const file = event.target.files[0]; // Get the first file
    const input = event.target;
    const slot = input.closest('.photo-slot');
    
    if (!file || !slot) {
        console.log('No file selected or slot not found');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = document.createElement('img');
        img.src = e.target.result;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        img.style.borderRadius = '10px';
        
        // Clear the slot and add the image
        slot.innerHTML = '';
        slot.appendChild(img);
        
        // Add remove button
        const removeBtn = document.createElement('button');
        removeBtn.innerHTML = '×';
        removeBtn.className = 'remove-photo-btn';
        removeBtn.style.cssText = 'position: absolute; top: 5px; right: 5px; background: rgba(0,0,0,0.7); color: white; border: none; border-radius: 50%; width: 25px; height: 25px; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; z-index: 10;';
        removeBtn.onclick = (e) => {
            e.preventDefault();
            const slotId = slot.id;
            const inputId = slotId.replace('photo-slot-', 'photo-input-');
            const isMainPhoto = slot.classList.contains('main-photo');
            
            slot.innerHTML = `
                <input type="file" id="${inputId}" accept="image/*" ${isMainPhoto ? 'multiple' : ''}>
                <div class="photo-placeholder">
                    <i class="fas fa-${isMainPhoto ? 'camera' : 'plus'}"></i>
                    <span>${isMainPhoto ? 'Main Photo' : 'Add Photo'}</span>
                </div>
            `;
            
            // Re-attach event listener
            const newInput = slot.querySelector('input');
            if (newInput) {
                newInput.addEventListener('change', handlePhotoUpload);
            }
        };
        slot.appendChild(removeBtn);
        
        // Store the file data for later upload
        slot.dataset.hasPhoto = 'true';
        slot.dataset.fileName = file.name;
    };
    reader.readAsDataURL(file);
}

async function getCurrentLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation is not supported'));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                try {
                    await api.updateLocation(latitude, longitude);
                    document.getElementById('location-status').innerHTML = 
                        '<div class="success">Location updated successfully!</div>';
                    resolve({ latitude, longitude });
                } catch (error) {
                    reject(error);
                }
            },
            (error) => {
                reject(new Error('Unable to get location'));
            }
        );
    });
}

// Matching Functions
async function loadPotentialMatches() {
    try {
        const response = await api.getPotentialMatches();
        appState.potentialMatches = response.matches;
        displayNextCard();
    } catch (error) {
        showError('Failed to load matches');
    }
}

function displayNextCard() {
    const container = document.querySelector('.cards-container');
    const noCardsDiv = document.getElementById('no-more-cards');
    
    // Clear existing cards
    container.querySelectorAll('.user-card').forEach(card => card.remove());
    
    if (appState.potentialMatches.length === 0) {
        noCardsDiv.style.display = 'block';
        return;
    }
    
    noCardsDiv.style.display = 'none';
    
    // Display next 3 cards (stack effect)
    const cardsToShow = appState.potentialMatches.slice(0, 3);
    
    cardsToShow.forEach((match, index) => {
        const card = createUserCard(match, index);
        container.appendChild(card);
    });
}

function createUserCard(user, stackIndex) {
    const card = document.createElement('div');
    card.className = 'user-card';
    card.style.zIndex = 100 - stackIndex;
    card.style.transform = `scale(${1 - stackIndex * 0.05}) translateY(${stackIndex * 10}px)`;
    
    const mainPhoto = user.photos.find(p => p.isMain) || user.photos[0];
    const photoUrl = mainPhoto ? mainPhoto.url : '/default-avatar.png';
    
    card.innerHTML = `
        <div class="card-image" style="background-image: url('${photoUrl}')">
            ${user.distance ? `<div class="card-distance">${user.distance} km away</div>` : ''}
            <div class="card-gradient"></div>
            <div class="card-info">
                <div class="card-name">${user.firstName} ${user.lastName}</div>
                <div class="card-details">${user.age} • ${user.course || user.university}</div>
                <div class="card-bio">${user.bio || 'No bio available'}</div>
            </div>
        </div>
    `;
    
    // Add swipe functionality
    addSwipeListeners(card, user);
    
    return card;
}

function addSwipeListeners(card, user) {
    let startX = 0;
    let currentX = 0;
    let isDragging = false;

    card.addEventListener('mousedown', startDrag);
    card.addEventListener('touchstart', startDrag);

    function startDrag(e) {
        isDragging = true;
        startX = e.type === 'mousedown' ? e.clientX : e.touches[0].clientX;
        card.classList.add('dragging');
        
        document.addEventListener('mousemove', drag);
        document.addEventListener('touchmove', drag);
        document.addEventListener('mouseup', endDrag);
        document.addEventListener('touchend', endDrag);
    }

    function drag(e) {
        if (!isDragging) return;
        
        currentX = (e.type === 'mousemove' ? e.clientX : e.touches[0].clientX) - startX;
        const rotation = currentX * 0.1;
        
        card.style.transform = `translateX(${currentX}px) rotate(${rotation}deg)`;
        
        // Add color overlay based on swipe direction
        const opacity = Math.abs(currentX) / 150;
        if (currentX > 50) {
            card.style.boxShadow = `0 0 20px rgba(255, 107, 157, ${opacity})`;
        } else if (currentX < -50) {
            card.style.boxShadow = `0 0 20px rgba(255, 71, 87, ${opacity})`;
        }
    }

    function endDrag() {
        if (!isDragging) return;
        isDragging = false;
        
        document.removeEventListener('mousemove', drag);
        document.removeEventListener('touchmove', drag);
        document.removeEventListener('mouseup', endDrag);
        document.removeEventListener('touchend', endDrag);
        
        card.classList.remove('dragging');
        
        // Determine swipe action
        if (currentX > 100) {
            likeUser(user, card);
        } else if (currentX < -100) {
            dislikeUser(user, card);
        } else {
            // Snap back
            card.style.transform = '';
            card.style.boxShadow = '';
        }
        
        currentX = 0;
    }
}

async function likeUser(user, card) {
    try {
        const response = await api.likeUser(user._id);
        
        // Animate card away
        card.style.transform = 'translateX(100%) rotate(30deg)';
        card.style.opacity = '0';
        
        setTimeout(() => {
            card.remove();
            appState.potentialMatches.shift();
            displayNextCard();
        }, 300);
        
        if (response.isMatch) {
            showMatchModal(response.matchedUser);
        }
    } catch (error) {
        showError('Failed to like user');
    }
}

async function dislikeUser(user, card) {
    try {
        await api.dislikeUser(user._id);
        
        // Animate card away
        card.style.transform = 'translateX(-100%) rotate(-30deg)';
        card.style.opacity = '0';
        
        setTimeout(() => {
            card.remove();
            appState.potentialMatches.shift();
            displayNextCard();
        }, 300);
    } catch (error) {
        showError('Failed to dislike user');
    }
}

function showMatchModal(matchedUser) {
    const modal = document.getElementById('match-modal');
    const userName = document.getElementById('match-user-name');
    const userImg1 = document.getElementById('match-user-1');
    const userImg2 = document.getElementById('match-user-2');
    
    userName.textContent = matchedUser.firstName;
    
    // Set user photos
    const currentUserPhoto = appState.user.photos?.find(p => p.isMain)?.url || '/default-avatar.png';
    const matchedUserPhoto = matchedUser.photos?.find(p => p.isMain)?.url || '/default-avatar.png';
    
    userImg1.src = currentUserPhoto;
    userImg2.src = matchedUserPhoto;
    
    modal.classList.add('active');
    
    // Store matched user for potential chat
    appState.currentMatch = matchedUser;
}

// Chat Functions
async function loadMatches() {
    try {
        const response = await api.getMatches();
        appState.matches = response.matches;
        displayMatches();
    } catch (error) {
        showError('Failed to load matches');
    }
}

function displayMatches() {
    const matchesList = document.getElementById('matches-list');
    matchesList.innerHTML = '';
    
    if (appState.matches.length === 0) {
        matchesList.innerHTML = `
            <div class="no-matches">
                <i class="fas fa-heart-broken"></i>
                <h3>No matches yet</h3>
                <p>Keep swiping to find your perfect match!</p>
            </div>
        `;
        return;
    }
    
    appState.matches.forEach(match => {
        const matchItem = document.createElement('div');
        matchItem.className = 'match-item';
        matchItem.onclick = () => openChat(match);
        
        const photo = match.photos?.find(p => p.isMain)?.url || '/default-avatar.png';
        
        matchItem.innerHTML = `
            <div style="position: relative;">
                <img src="${photo}" alt="${match.firstName}" class="match-avatar">
                ${match.isOnline ? '<div class="online-indicator"></div>' : ''}
            </div>
            <div class="match-info">
                <div class="match-name">${match.firstName} ${match.lastName}</div>
                <div class="match-last-message">Start a conversation!</div>
            </div>
            <div class="match-time">
                ${new Date(match.lastActive).toLocaleDateString()}
            </div>
        `;
        
        matchesList.appendChild(matchItem);
    });
}

async function openChat(user) {
    try {
        const response = await api.getChatWithUser(user._id);
        appState.currentChatId = response.chat._id;
        
        // Update chat header
        document.getElementById('chat-user-name').textContent = `${user.firstName} ${user.lastName}`;
        document.getElementById('chat-user-avatar').src = 
            user.photos?.find(p => p.isMain)?.url || '/default-avatar.png';
        document.getElementById('chat-user-status').textContent = 
            user.isOnline ? 'Online' : `Last seen ${new Date(user.lastActive).toLocaleDateString()}`;
        document.getElementById('chat-user-status').className = 
            `status ${user.isOnline ? 'online' : ''}`;
        
        // Join chat room
        if (appState.socket) {
            appState.socket.emit('join-chat', appState.currentChatId);
        }
        
        // Load messages
        await loadMessages();
        
        appState.showScreen('chat-screen');
    } catch (error) {
        showError('Failed to open chat');
    }
}

async function loadMessages() {
    try {
        const response = await api.getMessages(appState.currentChatId);
        const messagesContainer = document.getElementById('chat-messages');
        messagesContainer.innerHTML = '';
        
        response.messages.forEach(message => {
            displayMessage(message);
        });
        
        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    } catch (error) {
        showError('Failed to load messages');
    }
}

function displayMessage(message) {
    const messagesContainer = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${message.sender._id === appState.user.id ? 'sent' : 'received'}`;
    
    messageDiv.innerHTML = `
        <div class="message-bubble">
            ${message.content}
            <div class="message-time">
                ${new Date(message.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
            </div>
        </div>
    `;
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

async function sendMessage() {
    const input = document.getElementById('message-input');
    const content = input.value.trim();
    
    if (!content) return;
    
    try {
        const response = await api.sendMessage(appState.currentChatId, content);
        input.value = '';
        
        // Emit to socket for real-time delivery
        if (appState.socket) {
            appState.socket.emit('send-message', {
                chatId: appState.currentChatId,
                message: response.message
            });
        }
        
        displayMessage(response.message);
    } catch (error) {
        showError('Failed to send message');
    }
}

// Email Verification Handler
async function handleEmailVerification(token) {
    try {
        // Show loading state
        document.body.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: Arial, sans-serif;">
                <div style="text-align: center; padding: 20px;">
                    <h2 style="color: #e91e63;">Verifying your email...</h2>
                    <div style="margin: 20px 0;">
                        <div style="width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #e91e63; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto;"></div>
                    </div>
                </div>
            </div>
            <style>
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        `;

        const response = await fetch(`/api/auth/verify-email?token=${token}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (response.ok) {
            // Success - show success message and redirect
            document.body.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: Arial, sans-serif;">
                    <div style="text-align: center; padding: 20px; max-width: 400px;">
                        <div style="color: #4CAF50; font-size: 60px; margin-bottom: 20px;">✓</div>
                        <h2 style="color: #4CAF50; margin-bottom: 10px;">Email Verified Successfully!</h2>
                        <p style="color: #666; margin-bottom: 30px;">Your account has been verified. You can now log in to your account.</p>
                        <button id="go-to-login-btn" style="background-color: #e91e63; color: white; border: none; padding: 12px 30px; border-radius: 25px; font-size: 16px; cursor: pointer;">Go to Login</button>
                    </div>
                </div>
            `;
            
            // Add event listener to the button
            setTimeout(() => {
                const loginBtn = document.getElementById('go-to-login-btn');
                if (loginBtn) {
                    loginBtn.addEventListener('click', () => {
                        window.location.href = '/';
                    });
                }
            }, 100);
        } else {
            // Error - show error message
            document.body.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: Arial, sans-serif;">
                    <div style="text-align: center; padding: 20px; max-width: 400px;">
                        <div style="color: #f44336; font-size: 60px; margin-bottom: 20px;">✗</div>
                        <h2 style="color: #f44336; margin-bottom: 10px;">Verification Failed</h2>
                        <p style="color: #666; margin-bottom: 30px;">${data.message || 'Invalid or expired verification token.'}</p>
                        <button onclick="window.location.href='/';" style="background-color: #e91e63; color: white; border: none; padding: 12px 30px; border-radius: 25px; font-size: 16px; cursor: pointer;">Back to Login</button>
                    </div>
                </div>
            `;
        }
    } catch (error) {
        console.error('Verification error:', error);
        document.body.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: Arial, sans-serif;">
                <div style="text-align: center; padding: 20px; max-width: 400px;">
                    <div style="color: #f44336; font-size: 60px; margin-bottom: 20px;">✗</div>
                    <h2 style="color: #f44336; margin-bottom: 10px;">Verification Failed</h2>
                    <p style="color: #666; margin-bottom: 30px;">Something went wrong during verification. Please try again.</p>
                    <button onclick="window.location.href='/';" style="background-color: #e91e63; color: white; border: none; padding: 12px 30px; border-radius: 25px; font-size: 16px; cursor: pointer;">Back to Login</button>
                </div>
            </div>
        `;
    }
}

// App Initialization
async function initializeApp() {
    // Check if user is already logged in
    if (appState.token) {
        try {
            const response = await api.getCurrentUser();
            appState.setUser(response.user);
            
            if (response.user.profileCompleted) {
                appState.showScreen('main-app-screen');
                await loadPotentialMatches();
                await loadMatches();
            } else {
                appState.showScreen('profile-setup-screen');
            }
            
            initializeSocket();
        } catch (error) {
            appState.setToken(null);
            appState.showScreen('login-screen');
        }
    } else {
        appState.showScreen('login-screen');
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Check for email verification token in URL
    const urlParams = new URLSearchParams(window.location.search);
    const verificationToken = urlParams.get('token');
    
    if (verificationToken && window.location.pathname === '/verify-email') {
        handleEmailVerification(verificationToken);
        return;
    }
    
    // Initialize app after a short delay to show loading screen
    setTimeout(initializeApp, 1500);
    
    // Auth form handlers
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('signup-form').addEventListener('submit', handleSignup);
    document.getElementById('profile-setup-form').addEventListener('submit', handleProfileSetup);
    
    // Navigation between auth screens
    document.getElementById('show-signup').addEventListener('click', (e) => {
        e.preventDefault();
        appState.showScreen('signup-screen');
    });
    
    document.getElementById('show-login').addEventListener('click', (e) => {
        e.preventDefault();
        appState.showScreen('login-screen');
    });
    
    // Profile setup handlers - attach to all photo inputs
    document.querySelectorAll('[id^="photo-input-"]').forEach(input => {
        if (input) {
            input.addEventListener('change', handlePhotoUpload);
        }
    });
    
    // Also attach to photo slots for click handling
    document.querySelectorAll('.photo-slot').forEach(slot => {
        slot.addEventListener('click', (e) => {
            if (e.target.closest('.remove-photo-btn')) return; // Don't trigger on remove button
            const input = slot.querySelector('input[type="file"]');
            if (input) {
                input.click();
            }
        });
    });
    document.getElementById('get-location-btn').addEventListener('click', getCurrentLocation);
    
    // Bio character counter
    document.getElementById('setup-bio').addEventListener('input', (e) => {
        const charCount = document.querySelector('.char-count');
        charCount.textContent = `${e.target.value.length}/500`;
    });
    
    // Main app navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const tab = item.dataset.tab;
            appState.showTab(tab);
            
            // Load data when switching tabs
            if (tab === 'matches') {
                loadMatches();
            } else if (tab === 'discover') {
                if (appState.potentialMatches.length === 0) {
                    loadPotentialMatches();
                }
            }
        });
    });
    
    // Action buttons
    document.getElementById('like-btn').addEventListener('click', () => {
        const topCard = document.querySelector('.user-card');
        if (topCard && appState.potentialMatches.length > 0) {
            likeUser(appState.potentialMatches[0], topCard);
        }
    });
    
    document.getElementById('dislike-btn').addEventListener('click', () => {
        const topCard = document.querySelector('.user-card');
        if (topCard && appState.potentialMatches.length > 0) {
            dislikeUser(appState.potentialMatches[0], topCard);
        }
    });
    
    // Chat handlers
    document.getElementById('back-to-matches').addEventListener('click', () => {
        appState.showScreen('main-app-screen');
        appState.showTab('matches');
    });
    
    document.getElementById('send-message-btn').addEventListener('click', sendMessage);
    document.getElementById('message-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
    
    // Match modal handlers
    document.getElementById('send-message-match').addEventListener('click', () => {
        document.getElementById('match-modal').classList.remove('active');
        if (appState.currentMatch) {
            openChat(appState.currentMatch);
        }
    });
    
    document.getElementById('keep-swiping').addEventListener('click', () => {
        document.getElementById('match-modal').classList.remove('active');
    });
    
    // Refresh matches
    document.getElementById('refresh-matches').addEventListener('click', loadPotentialMatches);
    
    // Modal close handlers
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.target.closest('.modal').classList.remove('active');
        });
    });
    
    // Click outside modal to close
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    });
});
