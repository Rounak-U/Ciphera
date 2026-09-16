import { Router } from 'express';
import { searchUsers, getPublicKey } from './users.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/', searchUsers);
router.get('/:id/public-key', getPublicKey);

export default router;
