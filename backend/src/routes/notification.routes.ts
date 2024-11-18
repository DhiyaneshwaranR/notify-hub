import {Router} from 'express';
import NotificationController from '../controllers/notification.controller';
import {createNotificationValidators} from "../validators/notification.validator";
import {RateLimiter, RateLimitType} from '../security/rate-limiting/rate-limiter';
import redis from '../config/redis';
import {validate} from "../middleware/validation.middleware";

const router = Router();

const limiter = new RateLimiter(redis);

router.post('/', limiter.middleware({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30,
    type: RateLimitType.SLIDING_WINDOW,
    keyPrefix: 'send_notification'
}), createNotificationValidators, validate, NotificationController.createNotification);
router.get('/:id', NotificationController.getNotification);


export default router;
