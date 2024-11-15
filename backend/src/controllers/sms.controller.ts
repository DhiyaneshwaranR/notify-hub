import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/async.middleware';
import { BulkSMSService } from '../services/bulk-sms.service';
import { ApiError } from '../middleware/error.middleware';

class SMSController {
    private bulkSMSService: BulkSMSService;

    constructor() {
        this.bulkSMSService = new BulkSMSService();
    }

    sendBulkSMS = asyncHandler(async (req: Request, res: Response) => {
        const notification = req.body;

        if (!notification.recipients || notification.recipients.length === 0) {
            throw new ApiError(400, 'Recipients are required for bulk SMS');
        }

        const batchId = await this.bulkSMSService.sendBulkSMS(notification);

        res.status(202).json({
            status: 'accepted',
            data: {
                batchId,
                message: 'Bulk SMS processing started',
                statusEndpoint: `/api/v1/sms/bulk/${batchId}/status`
            }
        });
    });

    getBulkStatus = asyncHandler(async (req: Request, res: Response) => {
        const { batchId } = req.params;
        const status = await this.bulkSMSService.getBulkStatus(batchId);

        if (!status) {
            throw new ApiError(404, 'Batch not found');
        }

        res.status(200).json({
            status: 'success',
            data: status
        });
    });
}

export default new SMSController();