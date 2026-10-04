"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { generateRSAKeyPair, exportPublicKey, importPublicKey, exportPrivateKey, importPrivateKey, generateSigningKeyPair, exportSigningPublicKey, exportSigningPrivateKey, importSigningPrivateKey } from '@securechat/crypto';

interface User {
  id: string;
  username: string;
  email: string;
  publicKey: string;
  publicSigningKey?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  checkAuth: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  getPrivateKey: () => Promise<CryptoKey | null>;
  getPrivateSigningKey: () => Promise<CryptoKey | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

axios.defaults.withCredentials = true;
axios.defaults.timeout = 8000;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [privateKey, setPrivateKey] = useState<CryptoKey | null>(null);
  const [privateSigningKey, setPrivateSigningKey] = useState<CryptoKey | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
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
      
      const storedSignKey = localStorage.getItem(`securechat_signing_key_${userObj.id}`);
      if (storedSignKey) {
        try {
          const sKey = await importSigningPrivateKey(storedSignKey);
          setPrivateSigningKey(sKey);
        } catch (e) {
          console.error("Failed to restore signing key from local storage", e);
        }
      }
    } catch (error) {
      setUser(null);
      setPrivateKey(null);
      setPrivateSigningKey(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const res = await axios.post(`${API_URL}/auth/login`, { email, password });
    const userObj = res.data.user;
    
    const storedKey = localStorage.getItem(`securechat_private_key_${userObj.id}`);
    const storedSignKey = localStorage.getItem(`securechat_signing_key_${userObj.id}`);
    
    if (storedKey && storedSignKey) {
      try {
        const key = await importPrivateKey(storedKey);
        const sKey = await importSigningPrivateKey(storedSignKey);
        setPrivateKey(key);
        setPrivateSigningKey(sKey);
        setUser(userObj);
        return;
      } catch (e) {
        console.error("Corrupted local keys, generating new ones");
      }
    }

    console.warn("Generating new RSA and ECDSA key pairs for new session. Past messages may be unreadable.");
    const keyPair = await generateRSAKeyPair();
    const signKeyPair = await generateSigningKeyPair();
    
    setPrivateKey(keyPair.privateKey);
    setPrivateSigningKey(signKeyPair.privateKey);
    
    const exportedPriv = await exportPrivateKey(keyPair.privateKey);
    const exportedSignPriv = await exportSigningPrivateKey(signKeyPair.privateKey);
    
    localStorage.setItem(`securechat_private_key_${userObj.id}`, exportedPriv);
    localStorage.setItem(`securechat_signing_key_${userObj.id}`, exportedSignPriv);
    
    const publicKeyPem = await exportPublicKey(keyPair.publicKey);
    const publicSigningKeyPem = await exportSigningPublicKey(signKeyPair.publicKey);
    
    const updateRes = await axios.post(`${API_URL}/auth/login`, { 
      email, 
      password, 
      publicKey: publicKeyPem,
      publicSigningKey: publicSigningKeyPem 
    });
    setUser(updateRes.data.user);
  };

  const register = async (username: string, email: string, password: string) => {
    // Generate RSA and ECDSA key pairs on client side
    const keyPair = await generateRSAKeyPair();
    const signKeyPair = await generateSigningKeyPair();
    
    const publicKeyPem = await exportPublicKey(keyPair.publicKey);
    const publicSigningKeyPem = await exportSigningPublicKey(signKeyPair.publicKey);
    
    // Keep private keys in memory
    setPrivateKey(keyPair.privateKey);
    setPrivateSigningKey(signKeyPair.privateKey);
    
    const exportedPriv = await exportPrivateKey(keyPair.privateKey);
    const exportedSignPriv = await exportSigningPrivateKey(signKeyPair.privateKey);

    const res = await axios.post(`${API_URL}/auth/register`, {
      username,
      email,
      password,
      publicKey: publicKeyPem,
      publicSigningKey: publicSigningKeyPem,
    });
    
    const userObj = res.data.user;
    localStorage.setItem(`securechat_private_key_${userObj.id}`, exportedPriv);
    localStorage.setItem(`securechat_signing_key_${userObj.id}`, exportedSignPriv);
    setUser(userObj);
  };

  const logout = async () => {
    try {
      await axios.post(`${API_URL}/auth/logout`);
    } catch (e) {
      console.warn('Logout request failed', e);
    }
    
    setUser(null);
    setPrivateKey(null);
    setPrivateSigningKey(null);
    // Deliberately NOT removing from localStorage so users don't permanently lose their keys when logging out.
  };

  const deleteAccount = async () => {
    try {
      if (user?.id) {
        localStorage.removeItem(`securechat_private_key_${user.id}`);
      }
      await axios.delete(`${API_URL}/users/me`);
      setUser(null);
      setPrivateKey(null);
    } catch (e) {
      console.error('Failed to delete account', e);
      throw e;
    }
  };

  const getPrivateKey = async (): Promise<CryptoKey | null> => {
    return privateKey;
  };

  const getPrivateSigningKey = async (): Promise<CryptoKey | null> => {
    return privateSigningKey;
  };

  return (
    <AuthContext.Provider value={{ user, loading, checkAuth, login, register, logout, deleteAccount, getPrivateKey, getPrivateSigningKey }}>
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
