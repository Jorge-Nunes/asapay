import { Express, Request, Response } from 'express';
import { storage } from '../index';
import bcrypt from 'bcryptjs';
import { sendError } from '../middleware/error-handler';

function generateToken(userId: string): string {
  return Buffer.from(JSON.stringify({ userId, iat: Date.now() })).toString('base64');
}

export function registerAuthRoutes(app: Express) {
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: "Usuário e senha são obrigatórios" });
      }

      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ error: "Usuário ou senha incorretos" });
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ error: "Usuário ou senha incorretos" });
      }

      const token = generateToken(user.id);
      res.json({ token, userId: user.id, username: user.username });
    } catch (error) {
      sendError(res, error, 'Auth/Login');
    }
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const { username, password, fullName, phone, address } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: "Usuário e senha são obrigatórios" });
      }

      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ error: "Usuário já existe" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const newUser = await storage.createUser({
        username, password: hashedPassword,
        fullName: fullName || username,
        phone: phone || "", address: address || ""
      });

      const token = generateToken(newUser.id);
      res.json({ token, userId: newUser.id, username: newUser.username });
    } catch (error) {
      sendError(res, error, 'Auth/Register');
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    res.json({ success: true });
  });
}
