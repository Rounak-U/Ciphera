import { Router } from 'express';
import { searchUsers, getPublicKey, deleteAccount } from './users.controller';
import { authenticate } from '../middleware/auth.middleware';

const router: Router = Router();

router.get('/', authenticate, searchUsers);
router.get('/:id/public-key', authenticate, getPublicKey);
router.delete('/me', authenticate, deleteAccount);

export default router;
