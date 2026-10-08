import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../config/db.js';

export interface AuthenticatedUser {
  id: number;
  email: string;
  name: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

const JWT_SECRET = process.env.SESSION_SECRET || 'finsight_dev_secret_session_key_2026';

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // 1. Check HTTP-only cookie first
    let token = req.cookies?.token;

    // 2. Check Authorization header
    if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Authentication required. Please sign in to access this resource.',
      });
      return;
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET, { clockTolerance: 300 }) as { id: number; email: string };
    if (!decoded || !decoded.id) {
      res.status(401).json({
        success: false,
        message: 'Invalid or expired session token.',
      });
      return;
    }

    // Lookup user in database
    const [rows] = await query('SELECT id, name, email FROM users WHERE id = ?', [decoded.id]);
    if (!rows || rows.length === 0) {
      res.status(401).json({
        success: false,
        message: 'User account not found.',
      });
      return;
    }

    req.user = {
      id: rows[0].id,
      name: rows[0].name,
      email: rows[0].email,
    };

    next();
  } catch (err: any) {
    console.error('[requireAuth Error]', err.name, err.message);
    res.status(401).json({
      success: false,
      message: `Invalid or expired authentication session: ${err.message}`,
    });
  }
}
