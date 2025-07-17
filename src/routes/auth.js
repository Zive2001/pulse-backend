// routes/auth.js
import express from 'express';
import { azureLogin, login, getProfile, logout } from '../controllers/authController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Azure AD login route
router.post('/azure-login', azureLogin);

// Legacy login route (keep for backward compatibility)
router.post('/login', login);

// Get current user profile
router.get('/profile', authenticateToken, getProfile);

// Logout route
router.post('/logout', logout);

export default router;