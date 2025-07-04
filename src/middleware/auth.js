import { verifyToken } from '../config/jwt.js';
import { sendError } from '../utils/helpers.js';

/**
 * Authentication middleware
 * Verifies JWT token and sets req.user
 */
export const authenticateToken = (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return sendError(res, 401, 'Access token required');
    }

    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return sendError(res, 401, 'Token expired');
    } else if (error.name === 'JsonWebTokenError') {
      return sendError(res, 403, 'Invalid token');
    } else {
      return sendError(res, 403, 'Token verification failed');
    }
  }
};

/**
 * Role-based authorization middleware
 * Checks if user has required role(s)
 */
export const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, 401, 'User not authenticated');
    }

    if (!allowedRoles.includes(req.user.role)) {
      return sendError(res, 403, 'Insufficient permissions');
    }

    next();
  };
};

/**
 * Optional authentication middleware
 * Sets req.user if token exists, but doesn't require it
 */
export const optionalAuth = (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = verifyToken(token);
      req.user = decoded;
    }
    
    next();
  } catch (error) {
    // If token is invalid, continue without setting user
    next();
  }
};