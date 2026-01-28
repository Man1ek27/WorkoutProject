let currentUserRole = null;

async function login() {
    const user = document.getElementById('username').value;
    const pass = document.getElementById('password').value;

    const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user, password: pass })
    });

    if (response.ok) {
        const data = await response.json();
        localStorage.setItem('token', data.token);
        currentUserRole = data.role;
        document.getElementById('auth-status').innerText = `Zalogowano jako: ${user} (${data.role})`;
        document.getElementById('login-form').style.display = 'none';
        loadExercises();
    } else {
        alert("Błąd logowania!");
    }
}

async function loadExercises() {
    const response = await fetch('/api/exercises');
    const data = await response.json();
    const container = document.getElementById('exercise-list');
    container.innerHTML = '';

    data.forEach(ex => {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <h3>${ex.name}</h3>
            <p>Partia: ${ex.bodyPart}</p>
            <p>Cel: ${ex.target}</p>
            ${currentUserRole === 'admin' ? '<button class="btn-delete">Usuń (Admin)</button>' : ''}
        `;
        container.appendChild(card);
    });
}