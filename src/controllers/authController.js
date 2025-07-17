// controllers/authController.js
import { getDB, sql } from '../config/database.js';
import { generateToken } from '../config/jwt.js';
import { sendResponse, sendError, getUserRoleFromEmail } from '../utils/helpers.js';

/**
 * Azure AD login controller
 * Creates or updates user based on Azure AD info
 */
export const azureLogin = async (req, res) => {
  try {
    const { email, name, azureId, tenantId } = req.body;
    
    if (!email || !azureId) {
      return sendError(res, 400, 'Email and Azure ID are required');
    }
    
    const pool = getDB();
    
    // Check if user exists by email or azure_id
    const request = pool.request();
    request.input('email', sql.NVarChar, email);
    request.input('azureId', sql.NVarChar, azureId);
    
    let result = await request.query(`
      SELECT id, email, name, role, azure_id, tenant_id, created_at 
      FROM Users 
      WHERE email = @email OR azure_id = @azureId
    `);
    
    let user;
    
    if (result.recordset.length === 0) {
      // Create new user
      const role = getUserRoleFromEmail(email);
      const displayName = name || email.split('@')[0];
      
      const insertRequest = pool.request();
      insertRequest.input('email', sql.NVarChar, email);
      insertRequest.input('name', sql.NVarChar, displayName);
      insertRequest.input('role', sql.NVarChar, role);
      insertRequest.input('azureId', sql.NVarChar, azureId);
      insertRequest.input('tenantId', sql.NVarChar, tenantId);
      insertRequest.input('lastLogin', sql.DateTime2, new Date());
      
      const insertResult = await insertRequest.query(`
        INSERT INTO Users (email, name, role, azure_id, tenant_id, last_login)
        OUTPUT INSERTED.id, INSERTED.email, INSERTED.name, INSERTED.role, INSERTED.azure_id, INSERTED.tenant_id, INSERTED.created_at
        VALUES (@email, @name, @role, @azureId, @tenantId, @lastLogin)
      `);
      
      user = insertResult.recordset[0];
      console.log(`✅ New Azure AD user created: ${email} with role: ${role}`);
    } else {
      // Update existing user
      user = result.recordset[0];
      
      const updateRequest = pool.request();
      updateRequest.input('id', sql.Int, user.id);
      updateRequest.input('azureId', sql.NVarChar, azureId);
      updateRequest.input('tenantId', sql.NVarChar, tenantId);
      updateRequest.input('lastLogin', sql.DateTime2, new Date());
      updateRequest.input('name', sql.NVarChar, name || user.name);
      
      await updateRequest.query(`
        UPDATE Users 
        SET azure_id = @azureId, 
            tenant_id = @tenantId, 
            last_login = @lastLogin,
            name = @name,
            updated_at = GETDATE()
        WHERE id = @id
      `);
      
      console.log(`✅ Azure AD user updated: ${email}`);
    }
    
    // Generate JWT token
    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
      azureId: azureId
    });
    
    // Remove sensitive data from response
    const userData = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    };
    
    return sendResponse(res, 200, true, 'Azure AD login successful', {
      token,
      user: userData
    });
    
  } catch (error) {
    console.error('❌ Azure AD login error:', error);
    return sendError(res, 500, 'Azure AD login failed', error.message);
  }
};

/**
 * Legacy login controller (keep for backward compatibility)
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
      SELECT id, email, name, role, department, azure_id, tenant_id, last_login, created_at, updated_at
      FROM Users 
      WHERE id = @userId
    `);
    
    if (result.recordset.length === 0) {
      return sendError(res, 404, 'User not found');
    }
    
    const user = result.recordset[0];
    
    // Remove sensitive data
    const userData = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      department: user.department,
      lastLogin: user.last_login,
      createdAt: user.created_at,
      updatedAt: user.updated_at
    };
    
    return sendResponse(res, 200, true, 'Profile retrieved successfully', userData);
    
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