const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Usa la URL Externa por defecto si no existe la variable de entorno
const connectionString = process.env.DATABASE_URL || 'postgresql://cafeteria_db_o9ey_user:6qmHXfghFl2Kr23KeYB6TpFFTDX6IIt4@dpg-davtr93ncjis73fo19rg-a.oregon-postgres.render.com/cafeteria_db_o9ey';

const pool = new Pool({
  connectionString: connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

// Inicializar tablas en PostgreSQL
const initDb = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        usuario VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(100) NOT NULL
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS productos (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(150) NOT NULL,
        descripcion TEXT,
        precio NUMERIC(10, 2) NOT NULL
      );
    `);

    const res = await pool.query('SELECT COUNT(*) FROM usuarios');
    if (parseInt(res.rows[0].count) === 0) {
      await pool.query('INSERT INTO usuarios (usuario, password) VALUES ($1, $2)', ['admin', '1234']);
      console.log('Usuario por defecto creado: admin / 1234');
    }
    console.log('Conectado exitosamente a PostgreSQL en la nube.');
  } catch (err) {
    console.error('Error de conexión a PostgreSQL:', err.message);
  }
};

initDb();

// Endpoint: Login
app.post('/api/login', async (req, res) => {
  const { usuario, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM usuarios WHERE usuario = $1 AND password = $2', [usuario, password]);
    if (result.rows.length > 0) {
      res.json({ exito: true, mensaje: 'Inicio de sesión correcto', usuario: result.rows[0].usuario });
    } else {
      res.status(401).json({ exito: false, mensaje: 'Usuario o contraseña incorrectos' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// Endpoint: Obtener todos los usuarios
app.get('/api/usuarios', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, usuario FROM usuarios ORDER BY id ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint: Registrar/Agregar nuevo usuario
app.post('/api/usuarios', async (req, res) => {
  const { usuario, password } = req.body;
  if (!usuario || !password) return res.status(400).json({ error: 'Usuario y contraseña requeridos' });

  try {
    const result = await pool.query(
      'INSERT INTO usuarios (usuario, password) VALUES ($1, $2) RETURNING id, usuario',
      [usuario, password]
    );
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'El nombre de usuario ya existe' });
    res.status(500).json({ error: err.message });
  }
});

// Endpoint: Obtener menú
app.get('/api/menu', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM productos ORDER BY id ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint: Agregar producto
app.post('/api/menu', async (req, res) => {
  const { nombre, descripcion, precio } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO productos (nombre, descripcion, precio) VALUES ($1, $2, $3) RETURNING *',
      [nombre, descripcion, precio]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint: Editar producto
app.put('/api/menu/:id', async (req, res) => {
  const { id } = req.params;
  const { nombre, descripcion, precio } = req.body;
  try {
    const result = await pool.query(
      'UPDATE productos SET nombre = $1, descripcion = $2, precio = $3 WHERE id = $4',
      [nombre, descripcion, precio, id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json({ exito: true, mensaje: 'Producto actualizado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Ruta comodín para Express 5
app.get(/(.*)/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Backend escuchando en el puerto ${PORT}`);
});
