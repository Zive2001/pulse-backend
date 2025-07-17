// routes/admin.js
import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  deleteTicket,
  getAllSupportPersons,
  addSupportPerson,
  updateSupportPerson,
  deleteSupportPerson,
  addManager,
  updateUserRole,
  getAllCategories,
  addCategory,
  updateCategory,
  deleteCategory,
  getAllSubcategories,
  addSubcategory,
  updateSubcategory,
  deleteSubcategory,
  getAllUsers,
  getAdminLogs,
    debugAdminAccess
} from '../controllers/adminController.js';

const router = express.Router();

// Apply authentication middleware to all admin routes
router.use(authenticateToken);

// Ticket management
router.delete('/tickets/:id', deleteTicket);

// Support person management
router.get('/support-persons', getAllSupportPersons);
router.post('/support-persons', addSupportPerson);
router.put('/support-persons/:id', updateSupportPerson);
router.delete('/support-persons/:id', deleteSupportPerson);

// User/Manager management
router.get('/users', getAllUsers);
router.post('/managers', addManager);
router.put('/users/:id/role', updateUserRole);

// Category management
router.get('/categories', getAllCategories);
router.post('/categories', addCategory);
router.put('/categories/:id', updateCategory);
router.delete('/categories/:id', deleteCategory);

// Subcategory management
router.get('/subcategories', getAllSubcategories);
router.post('/subcategories', addSubcategory);
router.put('/subcategories/:id', updateSubcategory);
router.delete('/subcategories/:id', deleteSubcategory);

// Admin logs
router.get('/logs', getAdminLogs);

router.get('/debug', debugAdminAccess);

export default router;