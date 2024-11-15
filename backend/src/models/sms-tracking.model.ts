import mongoose, { Schema, Document } from 'mongoose';
import { SMSStatus } from '../types/sms';

export interface ISMSTracking extends Document {
    messageId: string;
    notificationId: string;
    status: SMSStatus;
    recipient: string;
    errorCode?: string;
    errorMessage?: string;
    provider: string;
    cost?: number;
    segments?: number;
    sentAt?: Date;
    deliveredAt?: Date;
    updatedAt: Date;
    metadata?: Record<string, any>;
}

const SMSTrackingSchema = new Schema({
    messageId: { type: String, required: true, index: true },
    notificationId: { type: String, required: true, index: true },
    status: {
        type: String,
        enum: Object.values(SMSStatus),
        required: true,
        index: true
    },
    recipient: { type: String, required: true, index: true },
    errorCode: String,
    errorMessage: String,
    provider: { type: String, required: true },
    cost: Number,
    segments: Number,
    sentAt: Date,
    deliveredAt: Date,
    updatedAt: { type: Date, required: true },
    metadata: { type: Map, of: Schema.Types.Mixed }
}, {
    timestamps: true
});

// Add compound indexes for efficient querying
SMSTrackingSchema.index({ notificationId: 1, status: 1 });
SMSTrackingSchema.index({ recipient: 1, createdAt: -1 });

export default mongoose.model<ISMSTracking>('SMSTracking', SMSTrackingSchema);