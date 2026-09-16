import { Request, Response } from 'express';
import { prisma } from '../database/db';

export const searchUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { q } = req.query;
    
    if (!q || typeof q !== 'string') {
      res.status(400).json({ error: 'Search query is required' });
      return;
    }

    const userId = (req as any).userId;

    const users = await prisma.user.findMany({
      where: {
        username: {
          contains: q,
          mode: 'insensitive'
        },
        id: {
          not: userId // exclude self
        }
      },
      select: {
        id: true,
        username: true,
        publicKey: true
      },
      take: 10
    });

    res.json(users);
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getPublicKey = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: id as string },
      select: {
        id: true,
        publicKey: true
      }
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};
