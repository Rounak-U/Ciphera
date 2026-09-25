"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import axios from 'axios';
import { useAuth } from './useAuth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  onlineUsers: Set<string>;
}

const SocketContext = createContext<SocketContextType>({ socket: null, isConnected: false, onlineUsers: new Set() });

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) {
      if (socket) {
        socket.disconnect();
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSocket(null);
      }
      return;
    }

    let active = true;
    let currentSocket: Socket | null = null;

    const connectSocket = async () => {
      try {
        const res = await axios.get(`${API_URL}/auth/socket-token`);
        
        const socketToken = res.data.socketToken;
        if (!active) return;

        // Ensure we gracefully handle trailing slashes in API_URL
        const baseUrl = API_URL.replace(/\/api\/?$/, '');

        currentSocket = io(baseUrl, {
          auth: { token: socketToken },
          withCredentials: true,
          reconnectionAttempts: 10,
          transports: ['polling', 'websocket'], // explicit transports
        });

        currentSocket.on('connect', () => {
          setIsConnected(true);
          currentSocket?.emit('get_online_users');
        });
        currentSocket.on('disconnect', () => setIsConnected(false));
        currentSocket.on('connect_error', (err) => {
          console.error('Socket connect_error:', err.message);
        });

        currentSocket.on('online_users', (userIds: string[]) => {
          setOnlineUsers(new Set(userIds));
        });

        currentSocket.on('user_online', (userId: string) => {
          setOnlineUsers(prev => {
            const next = new Set(prev);
            next.add(userId);
            return next;
          });
        });

        currentSocket.on('user_offline', (userId: string) => {
          setOnlineUsers(prev => {
            const next = new Set(prev);
            next.delete(userId);
            return next;
          });
        });
        
        setSocket(currentSocket);
      } catch (err) {
        console.error('Socket connection or token fetch failed:', err);
      }
    };

    connectSocket();

    return () => {
      active = false;
      if (currentSocket) currentSocket.disconnect();
      if (socket) socket.disconnect();
    };
  }, [user]);

  return (
    <SocketContext.Provider value={{ socket, isConnected, onlineUsers }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
