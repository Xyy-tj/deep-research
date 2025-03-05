import express from 'express';
import jwt from 'jsonwebtoken';
import { UserService } from '../services/user-service';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

/**
 * Middleware to authenticate JWT token
 */
export function authenticateJWT(req: express.Request, res: express.Response, next: express.NextFunction) {
    // First try to get token from Authorization header
    const authHeader = req.headers['authorization'];
    let token = authHeader && authHeader.split(' ')[1];
    
    // If no token in header, check cookies
    if (!token && req.cookies) {
        token = req.cookies.auth_token;
    }

    if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        
        (req as any).user = user;
        next();
    });
}

/**
 * Middleware to check if user is an admin
 */
export async function isAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
    try {
        const userId = (req as any).user?.id;
        
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        
        // Check if isAdmin is already in the token payload
        if ((req as any).user.isAdmin === true) {
            console.log('User is admin according to token payload');
            next();
            return;
        }
        
        // If not in token payload, check database
        const userService = new UserService();
        const user = await userService.getUserById(userId);
        
        console.log('User from database:', user);
        
        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }
        
        // Check if is_admin is 1 or true
        if (user.is_admin === 1 || user.is_admin === true) {
            console.log('User is admin according to database');
            next();
            return;
        }
        
        console.log('User is not admin');
        return res.status(403).json({ error: 'Admin access required' });
    } catch (error) {
        console.error('Error in admin middleware:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
