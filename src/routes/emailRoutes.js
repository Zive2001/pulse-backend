// routes/emailRoutes.js
import express from 'express';
import { testEmail } from '../controllers/emailController.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

// Test email endpoint (for debugging)
router.post('/test', authenticateToken, authorizeRoles('manager', 'digital_team'), testEmail);

// Add this to your emailRoutes.js for testing

// Debug endpoint to test manager approval email specifically
router.post('/debug/manager-approval', authenticateToken, authorizeRoles('manager', 'digital_team'), async (req, res) => {
  try {
    console.log('🧪 Testing manager approval email...');
    
    // Import the email functions
    const { notifyManagerApproval } = await import('../controllers/emailController.js');
    
    const testTicketData = {
      id: 39,
      ticket_number: 'TK202507186316',
      title: 'Internal Request - Manager Approval Required',
      description: 'This is a test ticket created by digital team member that requires manager approval.',
      type: 'Change Request',
      urgency: 'High',
      status: 'Pending Approval'
    };

    const testUserData = {
      name: req.user.name || 'Test User',
      email: req.user.email || 'test@example.com'
    };

    await notifyManagerApproval(testTicketData, testUserData);
    
    res.json({
      success: true,
      message: 'Manager approval email test completed',
      ticketData: testTicketData,
      userData: testUserData
    });
  } catch (error) {
    console.error('❌ Manager approval email test failed:', error);
    res.status(500).json({
      success: false,
      message: 'Manager approval email test failed',
      error: error.message,
      stack: error.stack
    });
  }
});

export default router;