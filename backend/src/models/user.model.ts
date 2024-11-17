import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from "bcryptjs";

export interface IUser extends Document {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role: 'admin' | 'user';
    apiKeys: Array<{
        key: string;
        name: string;
        createdAt: Date;
        lastUsed?: Date;
    }>;
    settings: {
        emailNotifications: boolean;
        smsNotifications: boolean;
    };
    status: 'active' | 'inactive';
    lastLogin?: Date;
    createdAt: Date;
    updatedAt: Date;
    comparePassword(candidatePassword: string): Promise<boolean>;
}

const userSchema = new Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        validate: {
            validator: (email: string) => {
                return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
            },
            message: 'Invalid email format'
        }
    },
    password: {
        type: String,
        required: true,
        minlength: 8,
        select: false // Don't return password by default
    },
    firstName: {
        type: String,
        required: true,
        trim: true
    },
    lastName: {
        type: String,
        required: true,
        trim: true
    },
    role: {
        type: String,
        enum: ['admin', 'user'],
        default: 'user'
    },
    apiKeys: [{
        key: String,
        name: String,
        createdAt: Date,
        lastUsed: Date
    }],
    settings: {
        emailNotifications: {
            type: Boolean,
            default: true
        },
        smsNotifications: {
            type: Boolean,
            default: true
        }
    },
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active'
    },
    lastLogin: Date
}, {
    timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();

    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error as Error);
    }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
    try {
        return await bcrypt.compare(candidatePassword, this.password);
    } catch (error) {
        throw new Error('Password comparison failed');
    }
};

export default mongoose.model<IUser>('User', userSchema);