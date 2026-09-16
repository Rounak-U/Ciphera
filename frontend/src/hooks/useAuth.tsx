"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { generateRSAKeyPair, exportPublicKey, importPublicKey, exportPrivateKey, importPrivateKey } from '@securechat/crypto';

interface User {
  id: string;
  username: string;
  email: string;
  publicKey: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  getPrivateKey: () => Promise<CryptoKey | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

axios.defaults.withCredentials = true;
axios.defaults.timeout = 8000;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [privateKey, setPrivateKey] = useState<CryptoKey | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await axios.get(`${API_URL}/auth/me`);
      const userObj = res.data.user;
      
      if (!userObj) {
        setUser(null);
        setPrivateKey(null);
        return;
      }
      
      setUser(userObj);
      
      const storedKey = localStorage.getItem(`securechat_private_key_${userObj.id}`);
      if (storedKey) {
        try {
          const key = await importPrivateKey(storedKey);
          setPrivateKey(key);
        } catch (e) {
          console.error("Failed to restore private key from local storage", e);
        }
      }
    } catch (error) {
      setUser(null);
      setPrivateKey(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const res = await axios.post(`${API_URL}/auth/login`, { email, password });
    const userObj = res.data.user;
    
    const storedKey = localStorage.getItem(`securechat_private_key_${userObj.id}`);
    if (storedKey) {
      try {
        const key = await importPrivateKey(storedKey);
        setPrivateKey(key);
        setUser(userObj);
        return;
      } catch (e) {
        console.error("Corrupted local key, generating new one");
      }
    }

    console.warn("Generating new RSA key pair for new session. Past messages may be unreadable.");
    const keyPair = await generateRSAKeyPair();
    setPrivateKey(keyPair.privateKey);
    
    const exportedPriv = await exportPrivateKey(keyPair.privateKey);
    localStorage.setItem(`securechat_private_key_${userObj.id}`, exportedPriv);
    
    const publicKeyPem = await exportPublicKey(keyPair.publicKey);
    const updateRes = await axios.post(`${API_URL}/auth/login`, { email, password, publicKey: publicKeyPem });
    setUser(updateRes.data.user);
  };

  const register = async (username: string, email: string, password: string) => {
    // Generate RSA key pair on client side
    const keyPair = await generateRSAKeyPair();
    const publicKeyPem = await exportPublicKey(keyPair.publicKey);
    
    // Keep private key in memory
    setPrivateKey(keyPair.privateKey);
    const exportedPriv = await exportPrivateKey(keyPair.privateKey);

    const res = await axios.post(`${API_URL}/auth/register`, {
      username,
      email,
      password,
      publicKey: publicKeyPem,
    });
    
    const userObj = res.data.user;
    localStorage.setItem(`securechat_private_key_${userObj.id}`, exportedPriv);
    setUser(userObj);
  };

  const logout = async () => {
    await axios.post(`${API_URL}/auth/logout`);
    setUser(null);
    setPrivateKey(null);
    // Deliberately NOT removing from localStorage so users don't permanently lose their keys when logging out.
  };

  const getPrivateKey = async () => {
    return privateKey;
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, getPrivateKey }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
