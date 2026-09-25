import { Router } from 'express';
import { createConversation, getConversations, getConversation, getMessages, createGroupConversation } from './conversations.controller';
import { authenticate } from '../middleware/auth.middleware';

const router: Router = Router();

router.use(authenticate);

router.post('/', createConversation);
router.post('/group', createGroupConversation);
router.get('/', getConversations);
router.get('/:id', getConversation);
router.get('/:id/messages', getMessages);

export default router;
