const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const app = express();

const SECRET = "twoj_klucz_2026";
app.use(express.json());
app.use(express.static('public'));
app.use('/images', express.static(path.join(__dirname, 'data', 'exercises')));

const db = new sqlite3.Database('./database.db');

db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, password TEXT, email TEXT, role TEXT DEFAULT 'user', created_at DATETIME DEFAULT CURRENT_TIMESTAMP)");
    db.run("CREATE TABLE IF NOT EXISTS exercises (id TEXT PRIMARY KEY, name TEXT, level TEXT, equipment TEXT, primaryMuscles TEXT, secondaryMuscles TEXT, instructions TEXT, category TEXT, images TEXT, mainImage TEXT)");
    db.run("CREATE TABLE IF NOT EXISTS plans (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, description TEXT, user_id INTEGER, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, is_public INTEGER DEFAULT 0)");
    db.run("CREATE TABLE IF NOT EXISTS plan_items (id INTEGER PRIMARY KEY AUTOINCREMENT, plan_id INTEGER, exercise_id TEXT, sets INTEGER DEFAULT 3, reps INTEGER DEFAULT 10, notes TEXT, order_index INTEGER)");

    db.all("PRAGMA table_info(users)", (err, columns) => {
        if (!err && columns) {
            const hasEmail = columns.some(col => col.name === 'email');
            const hasCreatedAt = columns.some(col => col.name === 'created_at');
            
            if (!hasEmail) {
                db.run("ALTER TABLE users ADD COLUMN email TEXT");
            }
            if (!hasCreatedAt) {
                db.run("ALTER TABLE users ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP");
            }
        }
    });

    db.all("PRAGMA table_info(exercises)", (err, columns) => {
        if (!err && columns) {
            const hasSecondaryMuscles = columns.some(col => col.name === 'secondaryMuscles');
            const hasCategory = columns.some(col => col.name === 'category');
            const hasImages = columns.some(col => col.name === 'images');
            
            if (!hasSecondaryMuscles) {
                db.run("ALTER TABLE exercises ADD COLUMN secondaryMuscles TEXT");
            }
            if (!hasCategory) {
                db.run("ALTER TABLE exercises ADD COLUMN category TEXT");
            }
            if (!hasImages) {
                db.run("ALTER TABLE exercises ADD COLUMN images TEXT");
            }
        }
    });

    db.all("PRAGMA table_info(plans)", (err, columns) => {
        if (!err && columns) {
            const hasDescription = columns.some(col => col.name === 'description');
            const hasCreatedAt = columns.some(col => col.name === 'created_at');
            const hasIsPublic = columns.some(col => col.name === 'is_public');
            
            if (!hasDescription) {
                db.run("ALTER TABLE plans ADD COLUMN description TEXT");
            }
            if (!hasCreatedAt) {
                db.run("ALTER TABLE plans ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP");
            }
            if (!hasIsPublic) {
                db.run("ALTER TABLE plans ADD COLUMN is_public INTEGER DEFAULT 0");
            }
        }
    });

    db.all("PRAGMA table_info(plan_items)", (err, columns) => {
        if (!err && columns) {
            const hasSets = columns.some(col => col.name === 'sets');
            const hasReps = columns.some(col => col.name === 'reps');
            const hasNotes = columns.some(col => col.name === 'notes');
            const hasOrderIndex = columns.some(col => col.name === 'order_index');
            
            if (!hasSets) {
                db.run("ALTER TABLE plan_items ADD COLUMN sets INTEGER DEFAULT 3");
            }
            if (!hasReps) {
                db.run("ALTER TABLE plan_items ADD COLUMN reps INTEGER DEFAULT 10");
            }
            if (!hasNotes) {
                db.run("ALTER TABLE plan_items ADD COLUMN notes TEXT");
            }
            if (!hasOrderIndex) {
                db.run("ALTER TABLE plan_items ADD COLUMN order_index INTEGER");
            }
        }
    });

    db.get("SELECT COUNT(*) as count FROM users WHERE role = 'admin'", (err, row) => {
        if (row && row.count === 0) {
            const hashedPassword = bcrypt.hashSync('admin123', 10);
            db.run("INSERT INTO users (username, password, email, role) VALUES (?, ?, ?, ?)", 
                ['admin', hashedPassword, 'admin@workout.pl', 'admin']);
        }
    });

    db.get("SELECT COUNT(*) as count FROM exercises", (err, row) => {
        if (row && row.count === 0) {
            const data = JSON.parse(fs.readFileSync('./data/exercises.json', 'utf8'));
            const stmt = db.prepare("INSERT INTO exercises VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
            data.forEach(ex => {
                stmt.run(
                    ex.id, 
                    ex.name, 
                    ex.level || 'Intermediate', 
                    ex.equipment || 'Body Only', 
                    JSON.stringify(ex.primaryMuscles || []), 
                    JSON.stringify(ex.secondaryMuscles || []),
                    JSON.stringify(ex.instructions || []),
                    ex.category || 'Strength',
                    JSON.stringify(ex.images || []),
                    ex.images && ex.images[0] ? ex.images[0] : 'placeholder.jpg'
                );
            });
            stmt.finalize();
        }
    });
});

const auth = (req, res, next) => {
    try {
        const token = req.headers.authorization.split(" ")[1];
        req.user = jwt.verify(token, SECRET);
        next();
    } catch (e) { 
        res.status(401).json({ error: "Brak autoryzacji" }); 
    }
};

const adminAuth = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ error: "Brak uprawnień administratora" });
    }
};


// Rejestracja nowego użytkownika
app.post('/api/register', (req, res) => {
    const { username, password, email } = req.body;
    
    if (!username || !password || !email) {
        return res.status(400).json({ error: "Wszystkie pola są wymagane" });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    
    db.run("INSERT INTO users (username, password, email, role) VALUES (?, ?, ?, ?)", 
        [username, hashedPassword, email, 'user'], 
        function(err) {
            if (err) {
                return res.status(400).json({ error: "Użytkownik już istnieje" });
            }
            const token = jwt.sign({ username, role: 'user', id: this.lastID }, SECRET);
            res.json({ success: true, token, role: 'user', userId: this.lastID, username });
        }
    );
});

// Logowanie użytkownika
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    db.get("SELECT * FROM users WHERE username = ?", [username], (err, user) => {
        if (err || !user) {
            return res.status(401).json({ error: "Nieprawidłowy login lub hasło" });
        }
        
        if (bcrypt.compareSync(password, user.password)) {
            const token = jwt.sign({ username: user.username, role: user.role, id: user.id }, SECRET);
            res.json({ token, role: user.role, userId: user.id, username: user.username });
        } else {
            res.status(401).json({ error: "Nieprawidłowy login lub hasło" });
        }
    });
});


app.get('/api/exercises', (req, res) => {
    const { limit = 50, offset = 0, level, equipment, muscle, search } = req.query;
    let query = "SELECT * FROM exercises WHERE 1=1";
    const params = [];
    
    if (level) {
        query += " AND level = ?";
        params.push(level);
    }
    if (equipment) {
        query += " AND equipment = ?";
        params.push(equipment);
    }
    if (muscle) {
        query += " AND (primaryMuscles LIKE ? OR secondaryMuscles LIKE ?)";
        params.push(`%${muscle}%`, `%${muscle}%`);
    }
    if (search) {
        query += " AND name LIKE ?";
        params.push(`%${search}%`);
    }
    
    query += " LIMIT ? OFFSET ?";
    params.push(parseInt(limit), parseInt(offset));
    
    db.all(query, params, (err, rows) => {
        if (err) {
            return res.status(500).json({ error: "Błąd serwera" });
        }
        res.json(rows);
    });
});

app.get('/api/exercises/:id', (req, res) => {
    db.get("SELECT * FROM exercises WHERE id = ?", [req.params.id], (err, row) => {
        if (err || !row) {
            return res.status(404).json({ error: "Ćwiczenie nie znalezione" });
        }
        res.json(row);
    });
});

app.get('/api/exercises/filters/values', (req, res) => {
    db.all("SELECT DISTINCT level FROM exercises WHERE level IS NOT NULL ORDER BY level", (err, levels) => {
        db.all("SELECT DISTINCT equipment FROM exercises WHERE equipment IS NOT NULL ORDER BY equipment", (err2, equipment) => {
            const result = {
                levels: levels.map(l => l.level),
                equipment: equipment.map(e => e.equipment)
            };
            res.json(result);
        });
    });
});


app.post('/api/plans', auth, (req, res) => {
    const { name, description, exercises } = req.body;
    
    db.run("INSERT INTO plans (name, description, user_id) VALUES (?, ?, ?)", 
        [name, description || '', req.user.id], 
        function(err) {
            if (err) {
                return res.status(500).json({ error: "Błąd podczas tworzenia planu" });
            }
            
            const planId = this.lastID;
            
            if (exercises && exercises.length > 0) {
                const stmt = db.prepare("INSERT INTO plan_items (plan_id, exercise_id, sets, reps, notes, order_index) VALUES (?, ?, ?, ?, ?, ?)");
                exercises.forEach((ex, index) => {
                    stmt.run(planId, ex.id || ex, ex.sets || 3, ex.reps || 10, ex.notes || '', index);
                });
                stmt.finalize();
            }
            
            res.json({ success: true, planId });
        }
    );
});

// Pobieranie planów użytkownika
app.get('/api/plans', auth, (req, res) => {
    db.all("SELECT * FROM plans WHERE user_id = ? ORDER BY created_at DESC", 
        [req.user.id], 
        (err, rows) => {
            if (err) {
                return res.status(500).json({ error: "Błąd serwera" });
            }
            res.json(rows);
        }
    );
});

// Pobieranie szczegółów planu z ćwiczeniami
app.get('/api/plans/:id', auth, (req, res) => {
    const planId = req.params.id;
    
    db.get("SELECT * FROM plans WHERE id = ? AND user_id = ?", 
        [planId, req.user.id], 
        (err, plan) => {
            if (err || !plan) {
                return res.status(404).json({ error: "Plan nie znaleziony" });
            }
            
            db.all(`
                SELECT pi.*, e.name, e.level, e.equipment, e.mainImage 
                FROM plan_items pi 
                JOIN exercises e ON pi.exercise_id = e.id 
                WHERE pi.plan_id = ? 
                ORDER BY pi.order_index
            `, [planId], (err, items) => {
                if (err) {
                    return res.status(500).json({ error: "Błąd serwera" });
                }
                res.json({ ...plan, exercises: items });
            });
        }
    );
});

// Usuwanie planu
app.delete('/api/plans/:id', auth, (req, res) => {
    db.run("DELETE FROM plans WHERE id = ? AND user_id = ?", 
        [req.params.id, req.user.id], 
        function(err) {
            if (err) {
                return res.status(500).json({ error: "Błąd serwera" });
            }
            db.run("DELETE FROM plan_items WHERE plan_id = ?", [req.params.id]);
            res.json({ success: true });
        }
    );
});


// Panel admina
app.get('/api/admin/users', auth, adminAuth, (req, res) => {
    db.all("SELECT id, username, email, role, created_at FROM users ORDER BY created_at DESC", 
        (err, rows) => {
            if (err) {
                return res.status(500).json({ error: "Błąd serwera" });
            }
            res.json(rows);
        }
    );
});

app.delete('/api/admin/users/:id', auth, adminAuth, (req, res) => {
    db.run("DELETE FROM users WHERE id = ?", [req.params.id], function(err) {
        if (err) {
            return res.status(500).json({ error: "Błąd serwera" });
        }
        res.json({ success: true });
    });
});

app.get('/api/admin/plans', auth, adminAuth, (req, res) => {
    db.all(`
        SELECT p.*, u.username 
        FROM plans p 
        JOIN users u ON p.user_id = u.id 
        ORDER BY p.created_at DESC
    `, (err, rows) => {
        if (err) {
            return res.status(500).json({ error: "Błąd serwera" });
        }
        res.json(rows);
    });
});

app.patch('/api/admin/users/:id/role', auth, adminAuth, (req, res) => {
    const { role } = req.body;
    
    db.run("UPDATE users SET role = ? WHERE id = ?", 
        [role, req.params.id], 
        function(err) {
            if (err) {
                return res.status(500).json({ error: "Błąd serwera" });
            }
            res.json({ success: true });
        }
    );
});

app.listen(process.env.PORT || 3000, () => {
    console.log('🚀 Serwer działa na porcie', process.env.PORT || 3000);
});