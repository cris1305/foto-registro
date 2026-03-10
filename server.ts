import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const db = new Database("biocheck.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    cedula TEXT UNIQUE NOT NULL,
    puesto TEXT NOT NULL,
    foto_biometrica TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS registro_entrada_salida (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER NOT NULL,
    tipo TEXT NOT NULL,
    fecha_hora DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
  );
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // API Routes
  app.post("/api/login", (req, res) => {
    const { username, password } = req.body;
    if (username === "admin" && password === "admin123") {
      return res.json({ role: "admin", user: { nombre: "Administrador" } });
    }
    if (username === "user" && password === "user123") {
      return res.json({ role: "user", user: { nombre: "Usuario General" } });
    }
    res.status(401).json({ error: "Credenciales inválidas" });
  });

  // Admin: Get all users
  app.get("/api/users", (req, res) => {
    const users = db.prepare("SELECT * FROM usuarios").all();
    res.json(users);
  });

  // Admin: Create user
  app.post("/api/users", (req, res) => {
    const { nombre, cedula, puesto, foto_biometrica } = req.body;
    try {
      const info = db.prepare(
        "INSERT INTO usuarios (nombre, cedula, puesto, foto_biometrica) VALUES (?, ?, ?, ?)"
      ).run(nombre, cedula, puesto, foto_biometrica);
      res.json({ id: info.lastInsertRowid });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Admin: Update user
  app.put("/api/users/:id", (req, res) => {
    const { id } = req.params;
    const { nombre, cedula, puesto, foto_biometrica } = req.body;
    try {
      db.prepare(
        "UPDATE usuarios SET nombre = ?, cedula = ?, puesto = ?, foto_biometrica = ? WHERE id = ?"
      ).run(nombre, cedula, puesto, foto_biometrica, id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Admin: Delete user
  app.delete("/api/users/:id", (req, res) => {
    const { id } = req.params;
    db.prepare("DELETE FROM usuarios WHERE id = ?").run(id);
    res.json({ success: true });
  });

  // User: Verify and Register Action
  app.post("/api/register-action", (req, res) => {
    const { cedula, tipo } = req.body;
    const user = db.prepare("SELECT * FROM usuarios WHERE cedula = ?").get(cedula) as any;
    
    if (!user) {
      return res.status(404).json({ error: "Usuario no registrado en el sistema." });
    }

    // Note: Facial verification happens on the frontend using Gemini, 
    // but we record the action here after frontend confirms match.
    const info = db.prepare(
      "INSERT INTO registro_entrada_salida (usuario_id, tipo) VALUES (?, ?)"
    ).run(user.id, tipo);

    res.json({ success: true, user: { nombre: user.nombre, puesto: user.puesto } });
  });

  // User: Get user by cedula for verification
  app.get("/api/users/verify/:cedula", (req, res) => {
    const { cedula } = req.params;
    const user = db.prepare("SELECT * FROM usuarios WHERE cedula = ?").get(cedula);
    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }
    res.json(user);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
