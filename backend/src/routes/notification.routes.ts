import { Router } from 'express';
import NotificationController from '../controllers/notification.controller';
import { createNotificationValidators } from '../validators/notification.validator';
import { validate } from '../middleware/validation.middleware';

const router = Router();

router.post('/', createNotificationValidators, validate, NotificationController.createNotification);
router.get('/:id', NotificationController.getNotification);

export default router;
