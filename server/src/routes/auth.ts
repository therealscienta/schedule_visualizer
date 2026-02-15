import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { getDatabase } from '../db/connection';
import { JWT_SECRET } from '../config';
import { authMiddleware } from '../middleware/auth';
import { AuthRequest } from '../types';

const router = Router();

// Validation schemas
const registerSchema = z.object({
  username: z.string().min(3).max(30),
  email: z.string().email(),
  password: z.string().min(6),
});

const loginSchema = z.object({
  identifier: z.string(), // Can be username or email
  password: z.string(),
});

// POST /register
router.post('/register', async (req, res, next) => {
  try {
    // Validate input
    const validation = registerSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Invalid input', details: validation.error.errors });
      return;
    }

    const { username, email, password } = validation.data;

    // Hash password
    const password_hash = await bcrypt.hash(password, 12);

    // Generate user ID
    const id = uuidv4();

    // Check if this is the first user
    const db = getDatabase();
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
    const role = userCount.count === 0 ? 'admin' : 'user';

    try {
      // Insert user
      const stmt = db.prepare(`
        INSERT INTO users (id, username, email, password_hash, role)
        VALUES (?, ?, ?, ?, ?)
      `);
      stmt.run(id, username, email, password_hash, role);

      // Generate JWT token
      const token = jwt.sign(
        { id, username, email, role },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      // Return user and token
      res.status(201).json({
        token,
        user: {
          id,
          username,
          email,
          role,
          is_active: 1,
        },
      });
    } catch (err: any) {
      // Handle unique constraint violations
      if (err.code === 'SQLITE_CONSTRAINT_UNIQUE' || err.message.includes('UNIQUE')) {
        res.status(409).json({ error: 'Username or email already exists' });
        return;
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
});

// POST /login
router.post('/login', async (req, res, next) => {
  try {
    // Validate input
    const validation = loginSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Invalid input', details: validation.error.errors });
      return;
    }

    const { identifier, password } = validation.data;

    // Find user by username or email
    const db = getDatabase();
    const user = db.prepare(`
      SELECT id, username, email, password_hash, role, is_active
      FROM users
      WHERE username = ? OR email = ?
    `).get(identifier, identifier) as any;

    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    if (!user.is_active) {
      res.status(401).json({ error: 'Account is disabled' });
      return;
    }

    // Compare password
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Return user and token
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        is_active: user.is_active,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /me - Get current user profile
router.get('/me', authMiddleware, (req: AuthRequest, res: Response, next) => {
  try {
    const db = getDatabase();
    const user = db.prepare(`
      SELECT id, username, email, role, is_active, created_at, updated_at
      FROM users
      WHERE id = ?
    `).get(req.user!.id);

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json(user);
  } catch (err) {
    next(err);
  }
});

export default router;
