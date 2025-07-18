// routes/emailRoutes.js
import express from 'express';
import { testEmail } from '../controllers/emailController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Test email endpoint (for debugging)
router.post('/test', authenticateToken, requireRole(['manager', 'digital_team']), testEmail);

export default router;