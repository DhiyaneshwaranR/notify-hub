import { Router } from 'express';
import SMSController from '../controllers/sms.controller';

const router = Router();

router.post('/bulk', SMSController.sendBulkSMS);
router.get('/bulk/:batchId/status', SMSController.getBulkStatus);

export default router;