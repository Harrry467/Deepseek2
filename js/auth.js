// js/auth.js
const USERS_KEY = 'smarttutor_users';
const SESSION_KEY = 'smarttutor_user';

function getUsers() {
    return JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
}

function saveUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function getCurrentUser() {
    return JSON.parse(localStorage.getItem(SESSION_KEY));
}

function setCurrentUser(user) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

function logout() {
    localStorage.removeItem(SESSION_KEY);
    window.location.href = 'index.html';
}

// Login form handler
document.getElementById('loginForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const users = getUsers();
    const user = users.find(u => u.email === email && u.password === password);
    if (user) {
        setCurrentUser({ name: user.name, email: user.email });
        window.location.href = 'dashboard.html';
    } else {
        alert('Invalid credentials');
    }
});

// Signup form handler
document.getElementById('signupForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const confirm = document.getElementById('confirmPassword').value;
    if (password !== confirm) {
        alert('Passwords do not match');
        return;
    }
    const users = getUsers();
    if (users.find(u => u.email === email)) {
        alert('Email already registered');
        return;
    }
    users.push({ name, email, password });
    saveUsers(users);
    setCurrentUser({ name, email });
    window.location.href = 'dashboard.html';
});
