import { Request, Response } from 'express';
import { prisma } from '../database/db';

export const createConversation = async (req: Request, res: Response): Promise<void> => {
  try {
    const { targetUserId, initialEncryptedKeyMaterial } = req.body;
    const userId = (req as any).userId;

    if (!targetUserId) {
      res.status(400).json({ error: 'targetUserId is required' });
      return;
    }

    if (userId === targetUserId) {
      res.status(400).json({ error: 'Cannot create a conversation with yourself' });
      return;
    }

    // Check if conversation already exists between these two users
    const existingConversation = await prisma.conversation.findFirst({
      where: {
        isGroup: false,
        AND: [
          { members: { some: { userId: userId } } },
          { members: { some: { userId: targetUserId } } }
        ]
      },
      include: {
        members: { include: { user: { select: { id: true, username: true, publicKey: true } } } },
        sessionKeys: { orderBy: { keyVersion: 'desc' }, take: 1 }
      }
    });

    if (existingConversation) {
      res.json(existingConversation);
      return;
    }

    // Create new conversation
    const newConversation = await prisma.conversation.create({
      data: {
        members: {
          create: [
            { userId: userId },
            { userId: targetUserId }
          ]
        },
        sessionKeys: {
          create: {
            keyVersion: 1,
            encryptedKeyMaterial: JSON.stringify(initialEncryptedKeyMaterial || {})
          }
        }
      },
      include: {
        members: { include: { user: { select: { id: true, username: true, publicKey: true } } } },
        sessionKeys: { orderBy: { keyVersion: 'desc' }, take: 1 }
      }
    });

    res.status(201).json(newConversation);
  } catch (error) {
    console.error('Create conversation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createGroupConversation = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, targetUserIds, initialEncryptedKeyMaterial } = req.body;
    const userId = (req as any).userId;

    if (!targetUserIds || !Array.isArray(targetUserIds) || targetUserIds.length === 0) {
      res.status(400).json({ error: 'targetUserIds array is required' });
      return;
    }

    const allMemberIds = Array.from(new Set([userId, ...targetUserIds]));

    const newConversation = await prisma.conversation.create({
      data: {
        isGroup: true,
        name: name || 'New Group',
        members: {
          create: allMemberIds.map(id => ({ userId: id }))
        },
        sessionKeys: {
          create: {
            keyVersion: 1,
            encryptedKeyMaterial: JSON.stringify(initialEncryptedKeyMaterial || {})
          }
        }
      },
      include: {
        members: { include: { user: { select: { id: true, username: true, publicKey: true } } } },
        sessionKeys: { orderBy: { keyVersion: 'desc' }, take: 1 }
      }
    });

    res.status(201).json(newConversation);
  } catch (error) {
    console.error('Create group conversation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getConversations = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;

    const conversations = await prisma.conversation.findMany({
      where: {
        members: { some: { userId } }
      },
      include: {
        members: { include: { user: { select: { id: true, username: true } } } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        sessionKeys: { orderBy: { keyVersion: 'desc' }, take: 1 },
        _count: {
          select: {
            messages: {
              where: {
                senderId: { not: userId },
                readAt: null
              }
            }
          }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    res.json(conversations);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getConversation = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;

    const conversation = await prisma.conversation.findUnique({
      where: { id: id as string },
      include: {
        members: { include: { user: { select: { id: true, username: true, publicKey: true } } } },
        sessionKeys: { orderBy: { keyVersion: 'desc' }, take: 1 }
      }
    });

    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    const isMember = conversation.members.some((m: any) => m.userId === userId);
    if (!isMember) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    res.json(conversation);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getMessages = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;

    // Check membership
    const memberCheck = await prisma.conversationMember.findFirst({
      where: { conversationId: id as string, userId: userId as string }
    });

    if (!memberCheck) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const messages = await prisma.message.findMany({
      where: { conversationId: id as string },
      orderBy: { createdAt: 'asc' },
      take: 100 // limit for now
    });

    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};
