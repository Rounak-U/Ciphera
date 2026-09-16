import { Router } from 'express';
import { register, login, logout, me, getSocketToken } from './auth.controller';
import { authenticate } from '../middleware/auth.middleware';

const router: Router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);
router.get('/me', me);
router.get('/socket-token', getSocketToken);

export default router;
