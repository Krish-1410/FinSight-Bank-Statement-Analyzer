import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query, insertInitialSampleTransactions } from '../config/db.js';

const JWT_SECRET = process.env.SESSION_SECRET || 'finsight_dev_secret_session_key_2026';
const JWT_EXPIRES_IN = '7d'; // 7 days valid session lifetime

function generateToken(userId: number, email: string): string {
  return jwt.sign({ id: userId, email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN as any });
}

function setAuthCookie(req: Request, res: Response, token: string): void {
  // Support iframes & Cloud Run preview HTTPS
  const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.cookie('token', token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: isSecure ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/',
  });
}

export async function register(req: Request, res: Response): Promise<void> {
  try {
    const { name, email, password, confirmPassword } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ success: false, message: 'Full Name is required.' });
      return;
    }

    if (!email || typeof email !== 'string') {
      res.status(400).json({ success: false, message: 'A valid email address is required.' });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      res.status(400).json({ success: false, message: 'Please provide a valid email format.' });
      return;
    }

    if (!password || typeof password !== 'string') {
      res.status(400).json({ success: false, message: 'Password is required.' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ success: false, message: 'Password must be at least 6 characters long.' });
      return;
    }

    if (password !== confirmPassword) {
      res.status(400).json({ success: false, message: 'Passwords do not match.' });
      return;
    }

    // Check if user already exists
    const [existingUsers] = await query('SELECT id FROM users WHERE email = ?', [cleanEmail]);
    if (existingUsers && existingUsers.length > 0) {
      res.status(409).json({ success: false, message: 'An account with this email already exists.' });
      return;
    }

    // Hash password with bcrypt
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const [result] = await query(
      'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
      [name.trim(), cleanEmail, passwordHash]
    );

    const userId = (result as any)?.insertId || (result as any)?.lastInsertRowid || 1;

    // Seed initial dataset so the user can immediately experience the financial dashboard
    try {
      await insertInitialSampleTransactions(userId, async (sql, p) => await query(sql, p));
    } catch (e) {
      // Non-fatal
    }

    const token = generateToken(userId, cleanEmail);
    setAuthCookie(req, res, token);

    res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      data: {
        user: {
          id: userId,
          name: name.trim(),
          email: cleanEmail,
        },
        token,
      },
    });
  } catch (err: any) {
    console.error('[Register Error]', err);
    res.status(500).json({ success: false, message: 'Failed to create account. Please try again.' });
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ success: false, message: 'Email and password are required.' });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const [rows] = await query('SELECT id, name, email, password_hash FROM users WHERE email = ?', [cleanEmail]);
    
    if (!rows || rows.length === 0) {
      res.status(401).json({ success: false, message: 'Invalid email or password.' });
      return;
    }

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      res.status(401).json({ success: false, message: 'Invalid email or password.' });
      return;
    }

    const token = generateToken(user.id, user.email);
    setAuthCookie(req, res, token);

    res.status(200).json({
      success: true,
      message: 'Signed in successfully.',
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
        token,
      },
    });
  } catch (err: any) {
    console.error('[Login Error]', err);
    res.status(500).json({ success: false, message: 'Sign in failed. Please try again later.' });
  }
}

export async function demoLogin(req: Request, res: Response): Promise<void> {
  try {
    const [rows] = await query('SELECT id, name, email FROM users WHERE email = ?', ['demo@finsight.app']);
    let user = rows && rows[0];

    if (!user) {
      const demoHash = '$2b$10$Ag1pu38UgBNtkEYgq2gy5eBN5TETE5HFJ1j5eQBIBayLDaHYodfaK';
      const [resInsert] = await query(
        'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
        ['Sujon Alex', 'demo@finsight.app', demoHash]
      );
      user = { id: resInsert.insertId, name: 'Sujon Alex', email: 'demo@finsight.app' };
      await insertInitialSampleTransactions(user.id, async (sql, p) => await query(sql, p));
    }

    const token = generateToken(user.id, user.email);
    setAuthCookie(req, res, token);

    res.status(200).json({
      success: true,
      message: 'Demo access granted.',
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
        token,
      },
    });
  } catch (err: any) {
    console.error('[Demo Login Error]', err);
    res.status(500).json({ success: false, message: 'Unable to start demo session.' });
  }
}

export async function logout(req: Request, res: Response): Promise<void> {
  res.clearCookie('token', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  });

  res.status(200).json({
    success: true,
    message: 'Signed out successfully.',
  });
}

export async function getMe(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Not authenticated.' });
    return;
  }

  try {
    const [rows] = await query('SELECT id, name, email, created_at FROM users WHERE id = ?', [req.user.id]);
    if (!rows || rows.length === 0) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        user: rows[0],
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Failed to retrieve profile.' });
  }
}

export async function changePassword(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Not authenticated.' });
    return;
  }

  try {
    const { currentPassword, newPassword, confirmNewPassword } = req.body;

    if (!currentPassword || !newPassword) {
      res.status(400).json({ success: false, message: 'Current password and new password are required.' });
      return;
    }

    if (newPassword.length < 6) {
      res.status(400).json({ success: false, message: 'New password must be at least 6 characters long.' });
      return;
    }

    if (newPassword !== confirmNewPassword) {
      res.status(400).json({ success: false, message: 'New passwords do not match.' });
      return;
    }

    const [rows] = await query('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
    if (!rows || rows.length === 0) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }

    const isMatch = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!isMatch) {
      res.status(400).json({ success: false, message: 'Current password is incorrect.' });
      return;
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await query('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, req.user.id]);

    res.status(200).json({
      success: true,
      message: 'Password updated successfully.',
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Failed to update password.' });
  }
}
