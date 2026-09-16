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

export const deleteAccount = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;

    await prisma.$transaction(async (tx) => {
      // Find all conversations the user is part of
      const memberships = await tx.conversationMember.findMany({
        where: { userId: userId },
        select: { conversationId: true }
      });
      const conversationIds = memberships.map(m => m.conversationId);

      // Delete all messages in these conversations
      if (conversationIds.length > 0) {
        await tx.message.deleteMany({
          where: { conversationId: { in: conversationIds } }
        });

        // Delete all session keys in these conversations
        await tx.sessionKeyMetadata.deleteMany({
          where: { conversationId: { in: conversationIds } }
        });

        // Delete all memberships in these conversations
        await tx.conversationMember.deleteMany({
          where: { conversationId: { in: conversationIds } }
        });

        // Delete the conversations themselves
        await tx.conversation.deleteMany({
          where: { id: { in: conversationIds } }
        });
      }

      // Delete any stray messages sent by this user (just in case)
      await tx.message.deleteMany({
        where: { senderId: userId }
      });

      // Finally delete the user
      await tx.user.delete({
        where: { id: userId }
      });
    });

    // Clear the auth cookie just like logout
    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production' || process.env.RENDER === 'true',
      sameSite: process.env.NODE_ENV === 'production' || process.env.RENDER === 'true' ? 'none' : 'lax',
    });

    res.json({ success: true, message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
