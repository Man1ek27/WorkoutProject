// Stan aplikacji
let currentUser = null;
let cart = [];
let allExercises = [];
let currentView = 'auth';

// ===== INICJALIZACJA =====
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
});

function checkAuth() {
    const token = localStorage.getItem('token');
    if (token) {
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            currentUser = payload;
            showMainApp();
        } catch (e) {
            logout();
        }
    }
}

// ===== SYSTEM POWIADOMIEŃ =====
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        info: 'fa-info-circle',
        warning: 'fa-exclamation-triangle'
    };
    
    toast.innerHTML = `
        <i class="fas ${icons[type]}"></i>
        <span>${message}</span>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ===== AUTORYZACJA =====
function toggleAuthForm() {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    
    if (loginForm.style.display === 'none') {
        loginForm.style.display = 'block';
        registerForm.style.display = 'none';
    } else {
        loginForm.style.display = 'none';
        registerForm.style.display = 'block';
    }
}

async function login() {
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    
    if (!username || !password) {
        showToast('Wypełnij wszystkie pola', 'error');
        return;
    }
    
    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({username, password})
        });
        
        const data = await res.json();
        
        if (res.ok) {
            localStorage.setItem('token', data.token);
            currentUser = { username: data.username, role: data.role, id: data.userId };
            showToast(`Witaj, ${username}!`, 'success');
            showMainApp();
        } else {
            showToast(data.error || 'Błąd logowania', 'error');
        }
    } catch (e) {
        showToast('Błąd połączenia z serwerem', 'error');
    }
}

async function register() {
    const username = document.getElementById('register-username').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    
    if (!username || !email || !password) {
        showToast('Wypełnij wszystkie pola', 'error');
        return;
    }
    
    if (password.length < 6) {
        showToast('Hasło musi mieć minimum 6 znaków', 'error');
        return;
    }
    
    try {
        const res = await fetch('/api/register', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({username, email, password})
        });
        
        const data = await res.json();
        
        if (res.ok) {
            localStorage.setItem('token', data.token);
            currentUser = { username: data.username, role: data.role, id: data.userId };
            showToast('Konto utworzone pomyślnie!', 'success');
            showMainApp();
        } else {
            showToast(data.error || 'Błąd rejestracji', 'error');
        }
    } catch (e) {
        showToast('Błąd połączenia z serwerem', 'error');
    }
}

function logout() {
    localStorage.removeItem('token');
    currentUser = null;
    cart = [];
    document.getElementById('navbar').style.display = 'none';
    showView('auth');
    showToast('Wylogowano pomyślnie', 'info');
}

function showMainApp() {
    document.getElementById('navbar').style.display = 'flex';
    document.getElementById('user-name').textContent = currentUser.username;
    
    if (currentUser.role === 'admin') {
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'block');
    }
    
    showView('exercises');
    loadExercises();
}

// ===== ZARZĄDZANIE WIDOKAMI =====
function showView(viewName) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    
    const viewMap = {
        'auth': 'auth-view',
        'exercises': 'exercises-view',
        'my-plans': 'my-plans-view',
        'create-plan': 'create-plan-view',
        'admin': 'admin-view'
    };
    
    const viewId = viewMap[viewName];
    const viewElement = document.getElementById(viewId);
    
    if (viewElement) {
        viewElement.classList.add('active');
        currentView = viewName;
        
        // Aktywuj odpowiedni link w nav
        document.querySelectorAll('.nav-link').forEach(link => {
            if (link.getAttribute('onclick')?.includes(viewName)) {
                link.classList.add('active');
            }
        });
        
        // Załaduj dane dla widoku
        if (viewName === 'exercises') loadExercises();
        if (viewName === 'my-plans') loadMyPlans();
        if (viewName === 'create-plan') updateCartDisplay();
        if (viewName === 'admin') loadAdminData();
    }
}

// ===== ĆWICZENIA =====
async function loadExercises() {
    const container = document.getElementById('exercise-list');
    const loading = document.getElementById('loading');
    
    loading.style.display = 'block';
    container.innerHTML = '';
    
    try {
        const search = document.getElementById('search-input')?.value || '';
        const level = document.getElementById('level-filter')?.value || '';
        const equipment = document.getElementById('equipment-filter')?.value || '';
        
        let url = '/api/exercises?limit=100';
        if (search) url += `&search=${search}`;
        if (level) url += `&level=${level}`;
        if (equipment) url += `&equipment=${equipment}`;
        
        const res = await fetch(url);
        allExercises = await res.json();
        
        displayExercises(allExercises);
    } catch (e) {
        showToast('Błąd podczas ładowania ćwiczeń', 'error');
    } finally {
        loading.style.display = 'none';
    }
}

function displayExercises(exercises) {
    const container = document.getElementById('exercise-list');
    
    if (exercises.length === 0) {
        container.innerHTML = '<div class="no-results"><i class="fas fa-search"></i><p>Nie znaleziono ćwiczeń</p></div>';
        return;
    }
    
    container.innerHTML = exercises.map(ex => `
        <div class="exercise-card">
            <div class="card-image" onclick="showExerciseDetails('${ex.id}')">
                <img src="/images/${ex.mainImage}" alt="${ex.name}" 
                     onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22200%22%3E%3Crect width=%22200%22 height=%22200%22 fill=%22%23333%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 fill=%22%23666%22 text-anchor=%22middle%22 dy=%22.3em%22%3EBrak zdjęcia%3C/text%3E%3C/svg%3E'">
                <div class="card-overlay">
                    <i class="fas fa-search-plus"></i>
                    <p>Zobacz szczegóły</p>
                </div>
            </div>
            <div class="card-content">
                <h3>${ex.name}</h3>
                <div class="card-tags">
                    <span class="tag tag-level">${getLevelLabel(ex.level)}</span>
                    <span class="tag tag-equipment">${ex.equipment}</span>
                </div>
                <button onclick="addToCart('${ex.id}')" class="btn-add">
                    <i class="fas fa-plus"></i> Dodaj do planu
                </button>
            </div>
        </div>
    `).join('');
}

function getLevelLabel(level) {
    const labels = {
        'Beginner': '🟢 Początkujący',
        'Intermediate': '🟡 Średni',
        'Expert': '🔴 Ekspert'
    };
    return labels[level] || level;
}

function filterExercises() {
    loadExercises();
}

async function showExerciseDetails(exerciseId) {
    try {
        const res = await fetch(`/api/exercises/${exerciseId}`);
        const exercise = await res.json();
        
        const images = JSON.parse(exercise.images || '[]');
        const instructions = JSON.parse(exercise.instructions || '[]');
        const primaryMuscles = JSON.parse(exercise.primaryMuscles || '[]');
        const secondaryMuscles = JSON.parse(exercise.secondaryMuscles || '[]');
        
        const modalBody = document.getElementById('modal-body');
        modalBody.innerHTML = `
            <div class="exercise-details">
                <h2>${exercise.name}</h2>
                
                <div class="detail-tags">
                    <span class="tag tag-level">${getLevelLabel(exercise.level)}</span>
                    <span class="tag tag-equipment"><i class="fas fa-dumbbell"></i> ${exercise.equipment}</span>
                </div>
                
                ${images.length > 0 ? `
                    <div class="image-gallery">
                        ${images.map(img => `
                            <img src="/images/${img}" alt="${exercise.name}" 
                                 onerror="this.style.display='none'">
                        `).join('')}
                    </div>
                ` : ''}
                
                ${primaryMuscles.length > 0 ? `
                    <div class="detail-section">
                        <h3><i class="fas fa-bullseye"></i> Główne mięśnie</h3>
                        <div class="muscles-list">
                            ${primaryMuscles.map(m => `<span class="muscle-tag primary">${m}</span>`).join('')}
                        </div>
                    </div>
                ` : ''}
                
                ${secondaryMuscles.length > 0 ? `
                    <div class="detail-section">
                        <h3><i class="fas fa-dot-circle"></i> Mięśnie pomocnicze</h3>
                        <div class="muscles-list">
                            ${secondaryMuscles.map(m => `<span class="muscle-tag secondary">${m}</span>`).join('')}
                        </div>
                    </div>
                ` : ''}
                
                ${instructions.length > 0 ? `
                    <div class="detail-section">
                        <h3><i class="fas fa-list-ol"></i> Instrukcja wykonania</h3>
                        <ol class="instructions-list">
                            ${instructions.map(inst => `<li>${inst}</li>`).join('')}
                        </ol>
                    </div>
                ` : ''}
                
                <button onclick="addToCart('${exercise.id}'); closeExerciseModal();" class="btn-primary">
                    <i class="fas fa-plus"></i> Dodaj do mojego planu
                </button>
            </div>
        `;
        
        document.getElementById('exercise-modal').classList.add('active');
        document.body.style.overflow = 'hidden';
    } catch (e) {
        showToast('Błąd podczas ładowania szczegółów', 'error');
    }
}

function closeExerciseModal() {
    document.getElementById('exercise-modal').classList.remove('active');
    document.body.style.overflow = 'auto';
}

// ===== KOSZYK I TWORZENIE PLANU =====
function addToCart(exerciseId) {
    const exercise = allExercises.find(ex => ex.id === exerciseId);
    
    if (!exercise) {
        showToast('Nie znaleziono ćwiczenia', 'error');
        return;
    }
    
    if (cart.find(item => item.id === exerciseId)) {
        showToast('To ćwiczenie jest już w planie', 'warning');
        return;
    }
    
    cart.push({
        id: exercise.id,
        name: exercise.name,
        level: exercise.level,
        equipment: exercise.equipment,
        mainImage: exercise.mainImage,
        sets: 3,
        reps: 10,
        notes: ''
    });
    
    showToast(`Dodano: ${exercise.name}`, 'success');
    updateCartDisplay();
}

function removeFromCart(exerciseId) {
    cart = cart.filter(item => item.id !== exerciseId);
    showToast('Usunięto z planu', 'info');
    updateCartDisplay();
}

function updateCartDisplay() {
    const cartCount = document.getElementById('cart-count');
    const cartContainer = document.getElementById('cart-exercises');
    
    if (cartCount) cartCount.textContent = cart.length;
    
    if (cartContainer) {
        if (cart.length === 0) {
            cartContainer.innerHTML = '<div class="empty-cart"><i class="fas fa-inbox"></i><p>Brak ćwiczeń w planie</p></div>';
        } else {
            cartContainer.innerHTML = cart.map((item, index) => `
                <div class="cart-item">
                    <img src="/images/${item.mainImage}" alt="${item.name}" 
                         onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2280%22 height=%2280%22%3E%3Crect width=%2280%22 height=%2280%22 fill=%22%23333%22/%3E%3C/svg%3E'">
                    <div class="cart-item-info">
                        <h4>${item.name}</h4>
                        <div class="cart-item-inputs">
                            <div class="input-group">
                                <label>Serie:</label>
                                <input type="number" value="${item.sets}" min="1" 
                                       onchange="updateCartItem(${index}, 'sets', this.value)">
                            </div>
                            <div class="input-group">
                                <label>Powtórzenia:</label>
                                <input type="number" value="${item.reps}" min="1" 
                                       onchange="updateCartItem(${index}, 'reps', this.value)">
                            </div>
                        </div>
                        <input type="text" placeholder="Notatki..." value="${item.notes}"
                               onchange="updateCartItem(${index}, 'notes', this.value)"
                               class="cart-notes">
                    </div>
                    <button onclick="removeFromCart('${item.id}')" class="btn-remove">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `).join('');
        }
    }
}

function updateCartItem(index, field, value) {
    if (cart[index]) {
        cart[index][field] = value;
    }
}

async function savePlan() {
    const name = document.getElementById('plan-name').value;
    const description = document.getElementById('plan-description').value;
    
    if (!name) {
        showToast('Podaj nazwę planu', 'error');
        return;
    }
    
    if (cart.length === 0) {
        showToast('Dodaj przynajmniej jedno ćwiczenie', 'error');
        return;
    }
    
    try {
        const res = await fetch('/api/plans', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ 
                name, 
                description,
                exercises: cart.map(item => ({
                    id: item.id,
                    sets: item.sets,
                    reps: item.reps,
                    notes: item.notes
                }))
            })
        });
        
        if (res.ok) {
            showToast('Plan zapisany pomyślnie!', 'success');
            cart = [];
            document.getElementById('plan-name').value = '';
            document.getElementById('plan-description').value = '';
            updateCartDisplay();
            showView('my-plans');
        } else {
            showToast('Błąd podczas zapisywania planu', 'error');
        }
    } catch (e) {
        showToast('Błąd połączenia z serwerem', 'error');
    }
}

// ===== MOJE PLANY =====
async function loadMyPlans() {
    const container = document.getElementById('plans-list');
    container.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Ładowanie...</div>';
    
    try {
        const res = await fetch('/api/plans', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        const plans = await res.json();
        
        if (plans.length === 0) {
            container.innerHTML = `
                <div class="no-results">
                    <i class="fas fa-clipboard"></i>
                    <p>Nie masz jeszcze żadnych planów</p>
                    <button onclick="showView('create-plan')" class="btn-primary">
                        <i class="fas fa-plus"></i> Stwórz pierwszy plan
                    </button>
                </div>
            `;
        } else {
            container.innerHTML = plans.map(plan => `
                <div class="plan-card">
                    <div class="plan-header">
                        <h3><i class="fas fa-clipboard-list"></i> ${plan.name}</h3>
                        <span class="plan-date">${formatDate(plan.created_at)}</span>
                    </div>
                    ${plan.description ? `<p class="plan-description">${plan.description}</p>` : ''}
                    <div class="plan-actions">
                        <button onclick="viewPlanDetails(${plan.id})" class="btn-view">
                            <i class="fas fa-eye"></i> Zobacz szczegóły
                        </button>
                        <button onclick="deletePlan(${plan.id})" class="btn-delete">
                            <i class="fas fa-trash"></i> Usuń
                        </button>
                    </div>
                </div>
            `).join('');
        }
    } catch (e) {
        showToast('Błąd podczas ładowania planów', 'error');
        container.innerHTML = '<div class="error">Błąd ładowania</div>';
    }
}

async function viewPlanDetails(planId) {
    try {
        const res = await fetch(`/api/plans/${planId}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        const plan = await res.json();
        
        const modalBody = document.getElementById('plan-modal-body');
        modalBody.innerHTML = `
            <div class="plan-details">
                <h2><i class="fas fa-clipboard-list"></i> ${plan.name}</h2>
                ${plan.description ? `<p class="plan-desc">${plan.description}</p>` : ''}
                <p class="plan-meta">Utworzony: ${formatDate(plan.created_at)}</p>
                
                <h3>Ćwiczenia w planie (${plan.exercises.length})</h3>
                <div class="plan-exercises-list">
                    ${plan.exercises.map((ex, index) => `
                        <div class="plan-exercise-item">
                            <span class="exercise-number">${index + 1}</span>
                            <img src="/images/${ex.mainImage}" alt="${ex.name}">
                            <div class="exercise-info">
                                <h4>${ex.name}</h4>
                                <p class="exercise-params">
                                    <i class="fas fa-redo"></i> ${ex.sets} serie × ${ex.reps} powtórzeń
                                </p>
                                ${ex.notes ? `<p class="exercise-notes"><i class="fas fa-sticky-note"></i> ${ex.notes}</p>` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        
        document.getElementById('plan-modal').classList.add('active');
        document.body.style.overflow = 'hidden';
    } catch (e) {
        showToast('Błąd podczas ładowania planu', 'error');
    }
}

function closePlanModal() {
    document.getElementById('plan-modal').classList.remove('active');
    document.body.style.overflow = 'auto';
}

async function deletePlan(planId) {
    if (!confirm('Czy na pewno chcesz usunąć ten plan?')) return;
    
    try {
        const res = await fetch(`/api/plans/${planId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (res.ok) {
            showToast('Plan usunięty', 'success');
            loadMyPlans();
        } else {
            showToast('Błąd podczas usuwania planu', 'error');
        }
    } catch (e) {
        showToast('Błąd połączenia z serwerem', 'error');
    }
}

// ===== PANEL ADMINA =====
function showAdminTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.admin-tab-content').forEach(content => content.style.display = 'none');
    
    event.target.classList.add('active');
    
    if (tab === 'users') {
        document.getElementById('admin-users-tab').style.display = 'block';
        loadAdminUsers();
    } else if (tab === 'plans') {
        document.getElementById('admin-plans-tab').style.display = 'block';
        loadAdminPlans();
    }
}

async function loadAdminData() {
    loadAdminUsers();
}

async function loadAdminUsers() {
    const container = document.getElementById('users-list');
    container.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Ładowanie...</div>';
    
    try {
        const res = await fetch('/api/admin/users', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        const users = await res.json();
        
        container.innerHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Użytkownik</th>
                        <th>Email</th>
                        <th>Rola</th>
                        <th>Data rejestracji</th>
                        <th>Akcje</th>
                    </tr>
                </thead>
                <tbody>
                    ${users.map(user => `
                        <tr>
                            <td>${user.id}</td>
                            <td><i class="fas fa-user"></i> ${user.username}</td>
                            <td>${user.email}</td>
                            <td>
                                <select onchange="changeUserRole(${user.id}, this.value)" 
                                        ${user.id === currentUser.id ? 'disabled' : ''}>
                                    <option value="user" ${user.role === 'user' ? 'selected' : ''}>User</option>
                                    <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                                </select>
                            </td>
                            <td>${formatDate(user.created_at)}</td>
                            <td>
                                <button onclick="deleteUser(${user.id})" 
                                        class="btn-delete-small"
                                        ${user.id === currentUser.id ? 'disabled' : ''}>
                                    <i class="fas fa-trash"></i>
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (e) {
        showToast('Błąd podczas ładowania użytkowników', 'error');
    }
}

async function loadAdminPlans() {
    const container = document.getElementById('admin-plans-list');
    container.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Ładowanie...</div>';
    
    try {
        const res = await fetch('/api/admin/plans', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        const plans = await res.json();
        
        container.innerHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Nazwa planu</th>
                        <th>Właściciel</th>
                        <th>Data utworzenia</th>
                    </tr>
                </thead>
                <tbody>
                    ${plans.map(plan => `
                        <tr>
                            <td>${plan.id}</td>
                            <td><i class="fas fa-clipboard-list"></i> ${plan.name}</td>
                            <td>${plan.username}</td>
                            <td>${formatDate(plan.created_at)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (e) {
        showToast('Błąd podczas ładowania planów', 'error');
    }
}

async function changeUserRole(userId, newRole) {
    try {
        const res = await fetch(`/api/admin/users/${userId}/role`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ role: newRole })
        });
        
        if (res.ok) {
            showToast('Rola użytkownika zmieniona', 'success');
        } else {
            showToast('Błąd podczas zmiany roli', 'error');
            loadAdminUsers();
        }
    } catch (e) {
        showToast('Błąd połączenia z serwerem', 'error');
    }
}

async function deleteUser(userId) {
    if (!confirm('Czy na pewno chcesz usunąć tego użytkownika?')) return;
    
    try {
        const res = await fetch(`/api/admin/users/${userId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (res.ok) {
            showToast('Użytkownik usunięty', 'success');
            loadAdminUsers();
        } else {
            showToast('Błąd podczas usuwania użytkownika', 'error');
        }
    } catch (e) {
        showToast('Błąd połączenia z serwerem', 'error');
    }
}

// ===== FUNKCJE POMOCNICZE =====
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('pl-PL', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Zamykanie modali po kliknięciu w tło
window.onclick = function(event) {
    const exerciseModal = document.getElementById('exercise-modal');
    const planModal = document.getElementById('plan-modal');
    
    if (event.target === exerciseModal) {
        closeExerciseModal();
    }
    if (event.target === planModal) {
        closePlanModal();
    }
}