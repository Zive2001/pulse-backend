// routes/emailRoutes.js
import express from 'express';
import { testEmail, testAzureEmail } from '../controllers/emailController.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

// Test email endpoint (for debugging)
router.post('/test', authenticateToken, authorizeRoles('manager', 'digital_team'), testEmail);

// Azure-specific test email endpoint
router.post('/test-azure', authenticateToken, authorizeRoles('manager', 'digital_team'), testAzureEmail);

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

    const result = await notifyManagerApproval(testTicketData, testUserData);
    
    res.json({
      success: result.success,
      message: result.success ? 'Manager approval email test completed successfully' : 'Manager approval email test failed',
      error: result.error || null,
      ticketData: testTicketData,
      userData: testUserData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Manager approval email test failed:', error);
    res.status(500).json({
      success: false,
      message: 'Manager approval email test failed',
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  }
});

// Debug endpoint to test ticket creation email
router.post('/debug/ticket-created', authenticateToken, authorizeRoles('manager', 'digital_team'), async (req, res) => {
  try {
    console.log('🧪 Testing ticket creation email...');
    
    // Import the email functions
    const { notifyTicketCreated } = await import('../controllers/emailController.js');
    
    const testTicketData = {
      id: 40,
      ticket_number: 'TK202507226321',
      title: 'Test Ticket - Email Functionality Check',
      description: 'This is a test ticket to verify email notifications are working correctly.',
      type: 'Application Error',
      urgency: 'Medium',
      status: 'Open'
    };

    const testUserData = {
      name: req.user.name || 'Test User',
      email: req.user.email || 'test@example.com'
    };

    const result = await notifyTicketCreated(testTicketData, testUserData);
    
    res.json({
      success: result.success,
      message: result.success ? 'Ticket creation email test completed successfully' : 'Ticket creation email test failed',
      error: result.error || null,
      ticketData: testTicketData,
      userData: testUserData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Ticket creation email test failed:', error);
    res.status(500).json({
      success: false,
      message: 'Ticket creation email test failed',
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  }
});

// Debug endpoint to test ticket update email
router.post('/debug/ticket-updated', authenticateToken, authorizeRoles('manager', 'digital_team'), async (req, res) => {
  try {
    console.log('🧪 Testing ticket update email...');
    
    // Import the email functions
    const { notifyTicketUpdated } = await import('../controllers/emailController.js');
    
    const testTicketData = {
      id: 41,
      ticket_number: 'TK202507226322',
      title: 'Test Ticket Update - Email Check',
      created_by_email: req.body.testEmail || req.user.email || 'test@example.com'
    };

    const testRemark = 'This is a test remark to verify email update notifications are working correctly.';
    const testStatus = 'In Progress';
    
    const testUpdatedByUser = {
      name: req.user.name || 'Test Support Agent',
      email: req.user.email || 'support@example.com'
    };

    const result = await notifyTicketUpdated(testTicketData, testRemark, testStatus, testUpdatedByUser);
    
    res.json({
      success: result.success,
      message: result.success ? 'Ticket update email test completed successfully' : 'Ticket update email test failed',
      error: result.error || null,
      ticketData: testTicketData,
      remark: testRemark,
      status: testStatus,
      updatedBy: testUpdatedByUser,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Ticket update email test failed:', error);
    res.status(500).json({
      success: false,
      message: 'Ticket update email test failed',
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  }
});

// Health check endpoint for email service
router.get('/health', authenticateToken, authorizeRoles('manager', 'digital_team'), async (req, res) => {
  try {
    console.log('🏥 Email service health check...');
    
    const healthData = {
      service: 'Email Service',
      status: 'checking',
      timestamp: new Date().toISOString(),
      environment: {
        nodeEnv: process.env.NODE_ENV,
        emailServiceUrl: process.env.EMAIL_SERVICE_URL || 'https://sg-prod-bdyapp-email.azurewebsites.net/Service.svc?wsdl',
        digitalTeamEmail: process.env.DIGITAL_TEAM_EMAIL || 'BodylineDigitalExcellence@masholdings.com',
        timeout: process.env.EMAIL_TIMEOUT || '90000',
        maxRetries: process.env.EMAIL_MAX_RETRIES || '3',
        applicationInsights: !!process.env.APPLICATIONINSIGHTS_CONNECTION_STRING
      },
      azure: {
        websiteName: process.env.WEBSITE_SITE_NAME,
        resourceGroup: process.env.WEBSITE_RESOURCE_GROUP,
        region: process.env.WEBSITE_RESOURCE_GROUP?.includes('eastasia') ? 'Southeast Asia' : 'Unknown'
      }
    };

    // Try to import email functions to check if they're working
    try {
      const { testEmail } = await import('../controllers/emailController.js');
      healthData.emailController = 'loaded';
      healthData.status = 'healthy';
    } catch (importError) {
      healthData.emailController = 'failed';
      healthData.status = 'unhealthy';
      healthData.error = importError.message;
    }

    const statusCode = healthData.status === 'healthy' ? 200 : 500;
    
    res.status(statusCode).json({
      success: healthData.status === 'healthy',
      message: `Email service is ${healthData.status}`,
      data: healthData
    });
  } catch (error) {
    console.error('❌ Email service health check failed:', error);
    res.status(500).json({
      success: false,
      message: 'Email service health check failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Configuration check endpoint
router.get('/config', authenticateToken, authorizeRoles('manager', 'digital_team'), (req, res) => {
  try {
    console.log('⚙️ Email configuration check...');
    
    const config = {
      emailServiceUrl: process.env.EMAIL_SERVICE_URL || 'NOT_SET',
      digitalTeamEmail: process.env.DIGITAL_TEAM_EMAIL || 'NOT_SET',
      timeout: process.env.EMAIL_TIMEOUT || 'NOT_SET (default: 90000)',
      connectionTimeout: process.env.EMAIL_CONNECTION_TIMEOUT || 'NOT_SET (default: 30000)',
      maxRetries: process.env.EMAIL_MAX_RETRIES || 'NOT_SET (default: 3)',
      retryDelay: process.env.EMAIL_RETRY_DELAY || 'NOT_SET (default: 2000)',
      corsOrigin: process.env.CORS_ORIGIN || 'NOT_SET',
      nodeEnv: process.env.NODE_ENV || 'NOT_SET',
      applicationInsights: process.env.APPLICATIONINSIGHTS_CONNECTION_STRING ? 'CONFIGURED' : 'NOT_SET',
      azureWebsiteName: process.env.WEBSITE_SITE_NAME || 'NOT_SET',
      azureResourceGroup: process.env.WEBSITE_RESOURCE_GROUP || 'NOT_SET'
    };

    const missingConfig = Object.keys(config).filter(key => 
      config[key] === 'NOT_SET' && 
      !['corsOrigin', 'azureWebsiteName', 'azureResourceGroup', 'applicationInsights'].includes(key)
    );

    res.json({
      success: missingConfig.length === 0,
      message: missingConfig.length === 0 ? 'All email configurations are set' : `Missing configurations: ${missingConfig.join(', ')}`,
      configuration: config,
      missingConfigurations: missingConfig,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Email configuration check failed:', error);
    res.status(500).json({
      success: false,
      message: 'Email configuration check failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;