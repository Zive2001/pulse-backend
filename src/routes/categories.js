//src/routes/categories.js
import express from 'express';
import { 
  getCategories, 
  getSupportPersonsByCategory, 
  getAllSupportPersons 
} from '../controllers/categoryController.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import { validateCategoryId } from '../middleware/validation.js';

const router = express.Router();

/**
 * @route   GET /api/categories
 * @desc    Get all categories with subcategories
 * @access  Public (for form display)
 */
router.get('/', getCategories);

/**
 * @route   GET /api/categories/:categoryId/support-persons
 * @desc    Get support persons by category
 * @access  Public (for form display)
 */
router.get('/:categoryId/support-persons', validateCategoryId, getSupportPersonsByCategory);

/**
 * @route   GET /api/categories/support-persons/all
 * @desc    Get all support persons (for filtering)
 * @access  Private (Manager, Digital Team, Admin)
 */
router.get('/support-persons/all', authenticateToken, authorizeRoles('manager', 'digital_team', 'admin'), getAllSupportPersons);

export default router;