// middleware/auth.js - Complete version with authorizeRoles
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

// Add the missing authorizeRoles function
export const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const userRole = req.user.role;
      const isAdmin = req.user.is_admin === true || req.user.role === 'admin';

      // Admin can access everything
      if (isAdmin) {
        console.log('✅ Admin access granted for:', req.user.email);
        return next();
      }

      // Check if user's role is in allowed roles
      if (allowedRoles.includes(userRole)) {
        console.log('✅ Role access granted:', userRole, 'for:', req.user.email);
        return next();
      }

      console.log('❌ Access denied. Required roles:', allowedRoles, 'User role:', userRole);
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });

    } catch (error) {
      console.error('❌ Authorization error:', error);
      return res.status(500).json({
        success: false,
        message: 'Authorization failed'
      });
    }
  };
};

// Helper function to check admin access
export const requireAdmin = (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    const isAdmin = req.user.is_admin === true || req.user.role === 'admin';

    if (!isAdmin) {
      console.log('❌ Admin access denied for:', req.user.email, 'Role:', req.user.role);
      return res.status(403).json({
        success: false,
        message: 'Admin privileges required'
      });
    }

    console.log('✅ Admin access granted for:', req.user.email);
    next();

  } catch (error) {
    console.error('❌ Admin check error:', error);
    return res.status(500).json({
      success: false,
      message: 'Admin check failed'
    });
  }
};

// Helper function to check specific permissions
export const requirePermission = (permission) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      // Admin has all permissions
      const isAdmin = req.user.is_admin === true || req.user.role === 'admin';
      if (isAdmin) {
        return next();
      }

      // Check specific permission
      const userPermissions = req.user.permissions ? req.user.permissions.split(',') : [];
      
      if (!userPermissions.includes(permission)) {
        console.log('❌ Permission denied:', permission, 'for:', req.user.email);
        return res.status(403).json({
          success: false,
          message: `Permission required: ${permission}`
        });
      }

      console.log('✅ Permission granted:', permission, 'for:', req.user.email);
      next();

    } catch (error) {
      console.error('❌ Permission check error:', error);
      return res.status(500).json({
        success: false,
        message: 'Permission check failed'
      });
    }
  };
};