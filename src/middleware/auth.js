// middleware/auth.js - Improved version
import jwt from 'jsonwebtoken';
import { getDB, sql } from '../config/database.js';

export const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }

    // Verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Fetch fresh user data from database to ensure we have latest admin status
    const pool = getDB();
    const request = pool.request();
    request.input('userId', sql.Int, decoded.id);
    
    const result = await request.query(`
      SELECT id, name, email, role, department, is_admin, permissions, created_at, updated_at
      FROM Users 
      WHERE id = @userId
    `);

    if (result.recordset.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = result.recordset[0];
    
    // Log user data for debugging
    console.log('🔍 Authenticated user:', {
      id: user.id,
      email: user.email,
      role: user.role,
      is_admin: user.is_admin,
      permissions: user.permissions
    });

    req.user = user;
    next();
    
  } catch (error) {
    console.error('❌ Authentication error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired'
      });
    }
    
    return res.status(500).json({
      success: false,
      message: 'Authentication failed'
    });
  }
};