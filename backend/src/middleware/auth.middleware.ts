import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretfallback_pleasechange';

export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const token = req.cookies?.token;
    
    if (!token) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    
    // Attach userId to the request object
    (req as any).userId = decoded.userId;
    
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};
