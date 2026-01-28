const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const app = express();

const SECRET = "twoj_klucz_2026";
app.use(express.json());
app.use(express.static('public'));
// Serwowanie zdjęć ćwiczeń z folderu data/exercises
app.use('/images', express.static(path.join(__dirname, 'data', 'exercises')));

const db = new sqlite3.Database('./database.db');

db.serialize(() => {
    // Rozszerzone tabele
    db.run("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT UNIQUE, password TEXT, role TEXT)");
    db.run("CREATE TABLE IF NOT EXISTS exercises (id TEXT PRIMARY KEY, name TEXT, level TEXT, equipment TEXT, primaryMuscles TEXT, instructions TEXT, mainImage TEXT)");
    db.run("CREATE TABLE IF NOT EXISTS plans (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, user_id INTEGER)");
    db.run("CREATE TABLE IF NOT EXISTS plan_items (id INTEGER PRIMARY KEY AUTOINCREMENT, plan_id INTEGER, exercise_id TEXT)");

    // Import danych z JSON (poprawione mapowanie pól)
    db.get("SELECT COUNT(*) as count FROM exercises", (err, row) => {
        if (row && row.count === 0) {
            const data = JSON.parse(fs.readFileSync('./data/exercises.json', 'utf8'));
            const stmt = db.prepare("INSERT INTO exercises VALUES (?, ?, ?, ?, ?, ?, ?)");
            data.forEach(ex => {
                stmt.run(
                    ex.id, 
                    ex.name, 
                    ex.level, 
                    ex.equipment, 
                    JSON.stringify(ex.primaryMuscles), 
                    JSON.stringify(ex.instructions),
                    ex.images[0] // Pierwsze zdjęcie jako główne
                );
            });
            stmt.finalize();
        }
    });
});

// Middleware do sprawdzania tokena
const auth = (req, res, next) => {
    try {
        const token = req.headers.authorization.split(" ")[1];
        req.user = jwt.verify(token, SECRET);
        next();
    } catch (e) { res.status(401).send("Brak autoryzacji"); }
};

// --- ENDPOINTY ---
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const role = username === 'admin' ? 'admin' : 'user';
    const token = jwt.sign({ username, role, id: 1 }, SECRET);
    res.json({ token, role });
});

app.get('/api/exercises', (req, res) => {
    db.all("SELECT * FROM exercises LIMIT 50", (err, rows) => res.json(rows));
});

// Tworzenie planu
app.post('/api/plans', auth, (req, res) => {
    const { name, exercises } = req.body;
    db.run("INSERT INTO plans (name, user_id) VALUES (?, ?)", [name, 1], function(err) {
        const planId = this.lastID;
        exercises.forEach(exId => {
            db.run("INSERT INTO plan_items (plan_id, exercise_id) VALUES (?, ?)", [planId, exId]);
        });
        res.json({ success: true });
    });
});

app.listen(process.env.PORT || 3000);