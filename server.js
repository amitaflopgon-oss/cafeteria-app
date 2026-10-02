const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();

// Usar el puerto de Render o el 3000 si estás local
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

// Servir los archivos web de la carpeta "public" (index.html, css, js)
app.use(express.static(path.join(__dirname, 'public')));

const db = new sqlite3.Database('./cafeteria.db', (err) => {
  if (err) {
    console.error('Error al conectar con SQLite:', err.message);
  } else {
    console.log('Conectado a la base de datos SQLite (cafeteria.db).');
  }
});

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS productos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      descripcion TEXT,
      precio REAL NOT NULL
    )
  `);

  db.get('SELECT COUNT(*) as count FROM usuarios', (err, row) => {
    if (row && row.count === 0) {
      db.run('INSERT INTO usuarios (usuario, password) VALUES (?, ?)', ['admin', '1234']);
      console.log('Usuario por defecto creado: admin / 1234');
    }
  });
});

// Endpoint: Login
app.post('/api/login', (req, res) => {
  const { usuario, password } = req.body;
  const sql = 'SELECT * FROM usuarios WHERE usuario = ? AND password = ?';

  db.get(sql, [usuario, password], (err, row) => {
    if (err) return res.status(500).json({ error: 'Error en el servidor' });
    if (row) {
      res.json({ exito: true, mensaje: 'Inicio de sesión correcto', usuario: row.usuario });
    } else {
      res.status(401).json({ exito: false, mensaje: 'Usuario o contraseña incorrectos' });
    }
  });
});

// Endpoint: Registrar nuevo usuario/cliente
app.post('/api/usuarios', (req, res) => {
  const { usuario, password } = req.body;
  if (!usuario || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
  }

  const sql = 'INSERT INTO usuarios (usuario, password) VALUES (?, ?)';
  db.run(sql, [usuario, password], function (err) {
    if (err) {
      if (err.message.includes('UNIQUE')) {
        return res.status(400).json({ error: 'El nombre de usuario ya existe' });
      }
      return res.status(500).json({ error: err.message });
    }
    res.json({ id: this.lastID, usuario });
  });
});

// Endpoint: Obtener todos los productos
app.get('/api/menu', (req, res) => {
  db.all('SELECT * FROM productos', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Endpoint: Agregar nuevo producto
app.post('/api/menu', (req, res) => {
  const { nombre, descripcion, precio } = req.body;
  const sql = 'INSERT INTO productos (nombre, descripcion, precio) VALUES (?, ?, ?)';
  db.run(sql, [nombre, descripcion, precio], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID, nombre, descripcion, precio });
  });
});

// Endpoint: Editar producto existente
app.put('/api/menu/:id', (req, res) => {
  const { id } = req.params;
  const { nombre, descripcion, precio } = req.body;
  const sql = 'UPDATE productos SET nombre = ?, descripcion = ?, precio = ? WHERE id = ?';

  db.run(sql, [nombre, descripcion, precio, id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json({ exito: true, mensaje: 'Producto actualizado correctamente' });
  });
});

// Ruta comodín compatible para servir el frontend
app.get('/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

process.on('SIGINT', () => {
  db.close(() => {
    console.log('Conexión con SQLite cerrada.');
    process.exit(0);
  });
});

app.listen(PORT, () => {
  console.log(`Backend escuchando en el puerto ${PORT}`);
});
