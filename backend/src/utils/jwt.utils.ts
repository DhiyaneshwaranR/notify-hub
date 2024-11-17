import jwt from 'jsonwebtoken';
import { IUser } from '../models/user.model';
import config from '../config';

export const generateToken = (user: IUser): string => {
    return jwt.sign(
        {
            sub: user._id,
            email: user.email,
            role: user.role
        },
        config.jwt.secret,
        {
            expiresIn: config.jwt.expiresIn
        }
    );
};

export const generateRefreshToken = (user: IUser): string => {
    return jwt.sign(
        {
            sub: user._id,
            type: 'refresh'
        },
        config.jwt.refreshSecret,
        {
            expiresIn: config.jwt.refreshExpiresIn
        }
    );
};