"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import axios from 'axios';
import { useAuth } from './useAuth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({ socket: null, isConnected: false });

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!user) {
      if (socket) {
        socket.disconnect();
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

        currentSocket.on('connect', () => setIsConnected(true));
        currentSocket.on('disconnect', () => setIsConnected(false));
        currentSocket.on('connect_error', (err) => {
          console.error('Socket connect_error:', err.message);
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
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
