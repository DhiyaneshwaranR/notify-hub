import { Router } from 'express';
import notificationRoutes from './notification.routes';
import authRoutes from "./auth.routes";

const router = Router();

router.use('/notifications', notificationRoutes);
router.use('/auth', authRoutes);

export default router;