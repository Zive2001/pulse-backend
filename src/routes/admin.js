// routes/admin.js
import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  deleteTicket,
  addSupportPerson,
  updateSupportPerson,
  deleteSupportPerson,
  addManager,
  updateUserRole,
  addCategory,
  updateCategory,
  deleteCategory,
  addSubcategory,
  getAllUsers,
  getAdminLogs
} from '../controllers/adminController.js';

const router = express.Router();

// Apply authentication middleware to all admin routes
router.use(authenticateToken);

// Ticket management
router.delete('/tickets/:id', deleteTicket);

// Support person management
router.post('/support-persons', addSupportPerson);
router.put('/support-persons/:id', updateSupportPerson);
router.delete('/support-persons/:id', deleteSupportPerson);

// User/Manager management
router.post('/managers', addManager);
router.put('/users/:id/role', updateUserRole);
router.get('/users', getAllUsers);

// Category management
router.post('/categories', addCategory);
router.put('/categories/:id', updateCategory);
router.delete('/categories/:id', deleteCategory);

// Subcategory management
router.post('/subcategories', addSubcategory);

// Admin logs
router.get('/logs', getAdminLogs);

export default router;