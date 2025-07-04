import { getDB, sql } from '../config/database.js';
import { generateToken } from '../config/jwt.js';
import { sendResponse, sendError, getUserRoleFromEmail } from '../utils/helpers.js';

/**
 * Dummy login controller
 * Creates user if doesn't exist and returns JWT token
 */
export const login = async (req, res) => {
  try {
    const { email } = req.body;
    const pool = getDB();
    
    // Check if user exists
    const request = pool.request();
    request.input('email', sql.NVarChar, email);
    
    let result = await request.query(`
      SELECT id, email, name, role, created_at 
      FROM Users 
      WHERE email = @email
    `);
    
    let user;
    
    if (result.recordset.length === 0) {
      // Create new user if doesn't exist
      const role = getUserRoleFromEmail(email);
      const name = email.split('@')[0];
      
      const insertRequest = pool.request();
      insertRequest.input('email', sql.NVarChar, email);
      insertRequest.input('name', sql.NVarChar, name);
      insertRequest.input('role', sql.NVarChar, role);
      
      const insertResult = await insertRequest.query(`
        INSERT INTO Users (email, name, role)
        OUTPUT INSERTED.id, INSERTED.email, INSERTED.name, INSERTED.role, INSERTED.created_at
        VALUES (@email, @name, @role)
      `);
      
      user = insertResult.recordset[0];
      console.log(`✅ New user created: ${email} with role: ${role}`);
    } else {
      user = result.recordset[0];
      console.log(`✅ User logged in: ${email}`);
    }
    
    // Generate JWT token
    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role
    });
    
    // Remove sensitive data from response
    const userData = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    };
    
    return sendResponse(res, 200, true, 'Login successful', {
      token,
      user: userData
    });
    
  } catch (error) {
    console.error('❌ Login error:', error);
    return sendError(res, 500, 'Login failed', error.message);
  }
};

/**
 * Get current user profile
 */
export const getProfile = async (req, res) => {
  try {
    const pool = getDB();
    const request = pool.request();
    request.input('userId', sql.Int, req.user.id);
    
    const result = await request.query(`
      SELECT id, email, name, role, department, created_at, updated_at
      FROM Users 
      WHERE id = @userId
    `);
    
    if (result.recordset.length === 0) {
      return sendError(res, 404, 'User not found');
    }
    
    const user = result.recordset[0];
    return sendResponse(res, 200, true, 'Profile retrieved successfully', user);
    
  } catch (error) {
    console.error('❌ Get profile error:', error);
    return sendError(res, 500, 'Failed to retrieve profile');
  }
};

/**
 * Logout (for completeness - JWT is stateless)
 */
export const logout = (req, res) => {
  // In a stateless JWT system, logout is handled client-side
  // by removing the token from storage
  return sendResponse(res, 200, true, 'Logged out successfully');
};