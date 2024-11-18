import { Request, Response } from 'express';
import NotificationService from '../services/notification.service';
import {NotificationRequest} from "../types/notification";
import {ApiError} from "../middleware/error.middleware";
import {asyncHandler} from "../middleware/async.middleware";


class NotificationController {
    createNotification = asyncHandler(async (req: Request, res: Response) => {
        const notificationRequest: NotificationRequest = req.body;

        if (!notificationRequest.recipients || !notificationRequest.content) {
            throw new ApiError(400, 'Invalid notification request');
        }

        const notification = await NotificationService.createNotification(notificationRequest);
        res.status(201).json({
            status: 'success',
            data: notification
        });
    });

    getNotification = asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;

        if (!id) {
            throw new ApiError(400, 'Notification ID is required');
        }

        const notification = await NotificationService.getNotificationById(id);
        res.status(200).json({
            status: 'success',
            data: notification
        });
    });
}

export default new NotificationController();