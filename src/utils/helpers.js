// utils/helpers.js

/**
 * Generate a unique ticket number
 * Format: TK + YYYYMMDD + 4-digit timestamp
 */
export const generateTicketNumber = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const timestamp = Date.now().toString().slice(-4);
  return `TK${year}${month}${day}${timestamp}`;
};

/**
 * Standard API response format
 */
export const sendResponse = (res, statusCode, success, message, data = null) => {
  return res.status(statusCode).json({
    success,
    message,
    data,
    timestamp: new Date().toISOString()
  });
};

/**
 * Error response helper
 */
export const sendError = (res, statusCode, message, errors = null) => {
  return res.status(statusCode).json({
    success: false,
    message,
    errors,
    timestamp: new Date().toISOString()
  });
};

/**
 * Determine user role based on email (for dummy login)
 */
export const getUserRoleFromEmail = (email) => {
  const lowercaseEmail = email.toLowerCase();
  
  if (lowercaseEmail.includes('manager')) {
    return 'manager';
  } else if (lowercaseEmail.includes('digital')) {
    return 'digital_team';
  } else {
    return 'general_user';
  }
};

/**
 * Validate admin permissions
 */
export const validateAdminPermissions = (user, requiredPermissions) => {
  if (!user || (!user.is_admin && user.role !== 'admin')) {
    return false;
  }
  
  if (!requiredPermissions || requiredPermissions.length === 0) {
    return true;
  }
  
  if (!user.permissions) {
    return false;
  }
  
  const userPermissions = user.permissions.split(',');
  return requiredPermissions.every(permission => 
    userPermissions.includes(permission)
  );
};

/**
 * Format date for SQL Server
 */
export const formatDateForSQL = (date) => {
  if (!date) return null;
  return new Date(date).toISOString().slice(0, 19).replace('T', ' ');
};

/**
 * Sanitize input for SQL injection prevention
 */
export const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  return input.replace(/['"\\]/g, '');
};

/**
 * Generate random password for new users
 */
export const generateRandomPassword = (length = 12) => {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
};

/**
 * Format admin action description
 */
export const formatAdminActionDescription = (action, details) => {
  const descriptions = {
    'add_support_person': `Added support person: ${details.name} (${details.email})`,
    'update_support_person': `Updated support person: ${details.name}`,
    'delete_support_person': `Deleted support person: ${details.name}`,
    'add_manager': `Added manager: ${details.name} (${details.email})`,
    'update_user_role': `Updated user role to: ${details.role}`,
    'add_category': `Added category: ${details.name}`,
    'update_category': `Updated category: ${details.name}`,
    'delete_category': `Deleted category: ${details.name}`,
    'add_subcategory': `Added subcategory: ${details.name}`,
    'delete_ticket': `Deleted ticket: ${details.ticket_number || details.id}`
  };
  
  return descriptions[action] || `Performed ${action}`;
};