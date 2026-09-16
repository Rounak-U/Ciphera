import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import authRoutes from './auth/auth.routes';
import usersRoutes from './users/users.routes';
import conversationsRoutes from './conversations/conversations.routes';
import { setupSocketHandlers } from './socket/socket';

dotenv.config();

const allowedOrigins = [
  'http://localhost:3000',
  'https://ciphera-chat.vercel.app',
  process.env.CLIENT_URL
].filter(Boolean) as string[];

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

app.use(helmet());
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/conversations', conversationsRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Socket.io integration
setupSocketHandlers(io);

const PORT = process.env.SERVER_PORT || 4000;

httpServer.listen(PORT, () => {
  console.log(`SecureChat Server is running on port ${PORT}`);
});
