import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { prisma } from '../database/db';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretfallback_pleasechange';

interface SocketWithUser extends Socket {
  userId?: string;
}

export const setupSocketHandlers = (io: Server) => {
  io.use((socket: SocketWithUser, next) => {
    try {
      const cookieHeader = socket.request.headers.cookie;
      if (!cookieHeader) throw new Error('No cookies');
      
      const tokenMatch = cookieHeader.match(/token=([^;]+)/);
      if (!tokenMatch) throw new Error('No token found');
      
      const token = tokenMatch[1];
      const decoded = jwt.verify(token as string, JWT_SECRET as string) as unknown as { userId: string };
      socket.userId = decoded.userId;
      next();
    } catch (err) {
      next(new Error('Authentication Error'));
    }
  });

  io.on('connection', (socket: SocketWithUser) => {
    const userId = socket.userId!;
    
    // Join a personal room for direct events
    socket.join(`user:${userId}`);

    socket.on('join_conversation', async (conversationId: string) => {
      // Check membership
      const membership = await prisma.conversationMember.findFirst({
        where: { conversationId, userId }
      });

      if (membership) {
        socket.join(`conversation:${conversationId}`);
      }
    });

    socket.on('send_message', async (data) => {
      try {
        const { conversationId, ciphertext, nonce, authTag, keyVersion } = data;
        
        // Save to DB
        const message = await prisma.message.create({
          data: {
            conversationId,
            senderId: userId,
            ciphertext,
            nonce,
            authTag: authTag || "",
            keyVersion
          },
          include: {
            sender: { select: { id: true, username: true } }
          }
        });

        // Broadcast to conversation
        io.to(`conversation:${conversationId}`).emit('receive_message', message);
      } catch (error) {
        console.error('send_message error', error);
      }
    });

    socket.on('key_rotation', async (data) => {
      try {
        const { conversationId, keyVersion, encryptedKeyMaterial } = data;
        
        // Ensure this user is a member
        const member = await prisma.conversationMember.findFirst({
          where: { conversationId, userId }
        });

        if (member) {
          const newSessionKey = await prisma.sessionKeyMetadata.create({
            data: {
              conversationId,
              keyVersion,
              encryptedKeyMaterial: JSON.stringify(encryptedKeyMaterial)
            }
          });

          // Mark previous as rotated
          await prisma.sessionKeyMetadata.updateMany({
            where: {
              conversationId,
              keyVersion: keyVersion - 1
            },
            data: {
              rotatedAt: new Date()
            }
          });

          io.to(`conversation:${conversationId}`).emit('key_rotation', newSessionKey);
        }
      } catch (error) {
        console.error('key_rotation error', error);
      }
    });

    socket.on('message_delivered', async (data) => {
      try {
        const { conversationId, messageIds } = data;
        if (!messageIds || messageIds.length === 0) return;
        
        await prisma.message.updateMany({
          where: {
            id: { in: messageIds },
            conversationId
          },
          data: {
            deliveredAt: new Date()
          }
        });
        
        io.to(`conversation:${conversationId}`).emit('message_delivered', { conversationId, messageIds, deliveredAt: new Date() });
      } catch (error) {
        console.error('message_delivered error', error);
      }
    });

    socket.on('message_read', async (data) => {
      try {
        const { conversationId, messageIds } = data;
        if (!messageIds || messageIds.length === 0) return;
        
        await prisma.message.updateMany({
          where: {
            id: { in: messageIds },
            conversationId
          },
          data: {
            readAt: new Date()
          }
        });
        
        io.to(`conversation:${conversationId}`).emit('message_read', { conversationId, messageIds, readAt: new Date() });
      } catch (error) {
        console.error('message_read error', error);
      }
    });

    
    socket.on('typing_start', (conversationId: string) => {
      socket.to(`conversation:${conversationId}`).emit('typing_start', { conversationId, userId });
    });

    socket.on('typing_stop', (conversationId: string) => {
      socket.to(`conversation:${conversationId}`).emit('typing_stop', { conversationId, userId });
    });

    socket.on('disconnect', () => {
      // Cleanup
    });
  });
};
