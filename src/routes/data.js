// routes/data.js
import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  getCategories,
  getSupportPersonsByCategory
} from '../controllers/dataController.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Get all categories with subcategories
router.get('/categories', getCategories);

// Get support persons by category
router.get('/categories/:categoryId/support-persons', getSupportPersonsByCategory);

export default router;