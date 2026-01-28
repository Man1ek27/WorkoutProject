let cart = [];
let userRole = '';

async function login() {
    const user = document.getElementById('username').value;
    const pass = document.getElementById('password').value;
    const res = await fetch('/api/login', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({username: user, password: pass})
    });
    const data = await res.json();
    localStorage.setItem('token', data.token);
    userRole = data.role;
    document.getElementById('auth-container').innerHTML = `Witaj ${user} (${userRole})`;
    loadExercises();
}

async function loadExercises() {
    const res = await fetch('/api/exercises');
    const exercises = await res.json();
    const container = document.getElementById('exercise-list');
    container.innerHTML = exercises.map(ex => `
        <div class="card">
            <img src="/images/${ex.mainImage}" alt="${ex.name}" onerror="this.src='https://via.placeholder.com/150'">
            <h3>${ex.name}</h3>
            <p><strong>Poziom:</strong> ${ex.level}</p>
            <p><strong>Sprzęt:</strong> ${ex.equipment}</p>
            <button onclick="addToPlan('${ex.id}')">Dodaj do planu</button>
        </div>
    `).join('');
}

function addToPlan(id) {
    cart.push(id);
    alert(`Dodano do planu. Masz już: ${cart.length} ćwiczeń.`);
}

async function savePlan() {
    const name = prompt("Podaj nazwę planu:");
    if(!name) return;
    await fetch('/api/plans', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ name, exercises: cart })
    });
    alert("Plan zapisany!");
    cart = [];
}