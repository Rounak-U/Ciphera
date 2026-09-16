import { Request, Response } from 'express';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { prisma } from '../database/db';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretfallback_pleasechange';

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, email, password, publicKey } = req.body;
    
    if (!username || !email || !password || !publicKey) {
      res.status(400).json({ error: 'All fields are required (username, email, password, publicKey)' });
      return;
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }]
      }
    });

    if (existingUser) {
      res.status(409).json({ error: 'Username or email already in use' });
      return;
    }

    // Hash password with Argon2id
    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 2 ** 16,
      timeCost: 3,
      parallelism: 1,
    });

    const user = await prisma.user.create({
      data: {
        username,
        email,
        passwordHash,
        publicKey
      }
    });

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '24h' });

    const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';
    res.cookie('token', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      maxAge: 24 * 60 * 60 * 1000,
    });

    res.status(201).json({
      message: 'Registration successful',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        publicKey: user.publicKey
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const isPasswordValid = await argon2.verify(user.passwordHash, password);

    if (!isPasswordValid) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const { publicKey } = req.body;
    let updatedPublicKey = user.publicKey;

    if (publicKey && publicKey !== user.publicKey) {
      await prisma.user.update({
        where: { id: user.id },
        data: { publicKey }
      });
      updatedPublicKey = publicKey;
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '24h' });

    const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';
    res.cookie('token', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      maxAge: 24 * 60 * 60 * 1000,
    });

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        publicKey: updatedPublicKey
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const logout = (req: Request, res: Response) => {
  res.clearCookie('token');
  res.json({ message: 'Logout successful' });
};

export const me = async (req: Request, res: Response): Promise<void> => {
  try {
    const token = req.cookies?.token;
    if (!token) {
      res.json({ user: null });
      return;
    }

    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (e) {
      res.json({ user: null });
      return;
    }
    
    const userId = decoded.userId;

    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      res.json({ user: null });
      return;
    }

    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        publicKey: user.publicKey
      }
    });
  } catch (error) {
    console.error('Me query error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
