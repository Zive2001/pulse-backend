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