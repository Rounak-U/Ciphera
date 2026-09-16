"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './useAuth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

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
        const res = await fetch(`${API_URL}/auth/socket-token`, { 
          method: 'GET',
          credentials: 'include' 
        });
        
        if (!res.ok) throw new Error('Failed to get socket token');
        
        const data = await res.json();
        if (!active) return;

        currentSocket = io(API_URL.replace('/api', ''), {
          auth: { token: data.socketToken },
          withCredentials: true,
          reconnectionAttempts: 5,
        });

        currentSocket.on('connect', () => setIsConnected(true));
        currentSocket.on('disconnect', () => setIsConnected(false));
        
        setSocket(currentSocket);
      } catch (err) {
        console.error('Socket connection failed:', err);
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
