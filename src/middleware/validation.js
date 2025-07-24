import { body, param, validationResult } from 'express-validator';
import { sendError } from '../utils/helpers.js';

/**
 * Handle validation errors
 */
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendError(res, 400, 'Validation failed', errors.array());
  }
  next();
};

/**
 * Validation rules for creating tickets
 */
export const validateCreateTicket = [
  body('title')
    .trim()
    .isLength({ min: 5, max: 255 })
    .withMessage('Title must be between 5 and 255 characters'),
  
  body('description')
    .trim()
    .isLength({ min: 10, max: 2000 })
    .withMessage('Description must be between 10 and 2000 characters'),
  
  body('category_id')
    .isInt({ min: 1 })
    .withMessage('Valid category ID is required'),
  

  body('urgency')
    .isIn(['High', 'Medium', 'Low'])
    .withMessage('Urgency must be High, Medium, or Low'),
  
  body('subcategory_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Subcategory ID must be a valid integer'),
  
  body('subcategory_text')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Subcategory text must not exceed 255 characters'),
  
  body('software_name')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Software name must not exceed 255 characters'),
  
  body('system_url')
    .optional()
    .trim()
    .isURL()
    .withMessage('System URL must be a valid URL'),
  
  body('mentioned_support_person')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Mentioned support person must be a valid ID'),
  
  handleValidationErrors
];

/**
 * Validation rules for login
 */
export const validateLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  
  handleValidationErrors
];

/**
 * Validation rules for updating ticket status
 */
export const validateUpdateTicketStatus = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Valid ticket ID is required'),
  
  body('status')
    .isIn(['Open', 'In Progress', 'Pending Approval', 'Resolved', 'Closed'])
    .withMessage('Invalid status value'),
  
  body('assigned_to')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Assigned to must be a valid user ID'),
  
  handleValidationErrors
];

/**
 * Validation rules for ticket ID parameter
 */
export const validateTicketId = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Valid ticket ID is required'),
  
  handleValidationErrors
];

/**
 * Validation rules for category ID parameter
 */
export const validateCategoryId = [
  param('categoryId')
    .isInt({ min: 1 })
    .withMessage('Valid category ID is required'),
  
  handleValidationErrors
];

// In your validation middleware
export const validateTicketRemark = (req, res, next) => {
  const { remark } = req.body;
  
  if (!remark || remark.trim() === '') {
    return res.status(400).json({
      success: false,
      message: 'Remark is required'
    });
  }
  
  next();
};