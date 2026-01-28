const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = "twoj_super_tajny_klucz";

app.use(express.json());
app.use(express.static('public'));

// Inicjalizacja bazy danych
const db = new sqlite3.Database('./database.db');

db.serialize(() => {
    // Tabela użytkowników z rolami
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        role TEXT
    )`);

    // Tabela ćwiczeń
    db.run(`CREATE TABLE IF NOT EXISTS exercises (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        bodyPart TEXT,
        target TEXT,
        gifUrl TEXT
    )`);

    // Import danych z JSON jeśli baza jest pusta
    db.get("SELECT COUNT(*) as count FROM exercises", (err, row) => {
        if (row.count === 0) {
            const exercisesData = JSON.parse(fs.readFileSync('./data/exercises.json', 'utf8'));
            const stmt = db.prepare("INSERT INTO exercises (name, bodyPart, target, gifUrl) VALUES (?, ?, ?, ?)");
            exercisesData.forEach(ex => stmt.run(ex.name, ex.bodyPart, ex.target, ex.gifUrl));
            stmt.finalize();
            console.log("Dane zaimportowane pomyślnie!");
        }
    });
});

// --- API ENDPOINTS ---

// Logowanie
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    // Dla uproszczenia na projekt: admin/admin lub user/user
    if ((username === 'admin' && password === 'admin') || (username === 'user' && password === 'user')) {
        const role = username === 'admin' ? 'admin' : 'viewer';
        const token = jwt.sign({ username, role }, SECRET_KEY, { expiresIn: '1h' });
        return res.json({ token, role });
    }
    res.status(401).json({ message: "Błędne dane logowania" });
});

// Pobieranie ćwiczeń (REST)
app.get('/api/exercises', (req, res) => {
    db.all("SELECT * FROM exercises LIMIT 20", [], (err, rows) => {
        res.json(rows);
    });
});

app.listen(PORT, () => console.log(`Serwer działa na http://localhost:${PORT}`));