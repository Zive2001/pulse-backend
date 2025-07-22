// emailController.js - Enhanced for Azure App Service with Environment Variables
import soap from 'soap';
import { sendResponse, sendError } from '../utils/helpers.js';
import http from 'http';
import https from 'https';

// Environment-based configuration
const EMAIL_SERVICE_URL = process.env.EMAIL_SERVICE_URL || 'https://sg-prod-bdyapp-email.azurewebsites.net/Service.svc?wsdl';
const SYSTEM_URL = process.env.CORS_ORIGIN?.split(',')[0] || 'https://sg-prod-bdyapp-pulsefrontend-g9aqfserb6bea8eq.southeastasia-01.azurewebsites.net/';
const DIGITAL_TEAM_EMAIL = process.env.DIGITAL_TEAM_EMAIL || 'BodylineDigitalExcellence@masholdings.com';

// Timeout and retry configuration from environment
const EMAIL_TIMEOUT = parseInt(process.env.EMAIL_TIMEOUT) || 90000;
const EMAIL_CONNECTION_TIMEOUT = parseInt(process.env.EMAIL_CONNECTION_TIMEOUT) || 30000;
const EMAIL_MAX_RETRIES = parseInt(process.env.EMAIL_MAX_RETRIES) || 3;
const EMAIL_RETRY_DELAY = parseInt(process.env.EMAIL_RETRY_DELAY) || 2000;

// Configure HTTP agents for better connection management in Azure
const httpAgent = new http.Agent({
  keepAlive: true,
  keepAliveMsecs: 30000,
  maxSockets: 5,
  maxFreeSockets: 2,
  timeout: EMAIL_CONNECTION_TIMEOUT
});

const httpsAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 30000,
  maxSockets: 5,
  maxFreeSockets: 2,
  timeout: EMAIL_CONNECTION_TIMEOUT
});

// SOAP client options optimized for Azure
const SOAP_OPTIONS = {
  timeout: EMAIL_TIMEOUT,
  connection_timeout: EMAIL_CONNECTION_TIMEOUT,
  httpClient: {
    httpAgent: httpAgent,
    httpsAgent: httpsAgent,
    timeout: EMAIL_TIMEOUT
  },
  request: {
    timeout: EMAIL_TIMEOUT,
    headers: {
      'User-Agent': 'AzureAppService-EmailClient/1.0',
      'Connection': 'keep-alive',
      'Keep-Alive': 'timeout=60'
    }
  },
  // Add retry mechanism
  maxRetries: EMAIL_MAX_RETRIES,
  retryDelay: EMAIL_RETRY_DELAY
};

/**
 * Log to Application Insights if available
 */
const logToApplicationInsights = (error, context) => {
  if (process.env.APPLICATIONINSIGHTS_CONNECTION_STRING) {
    try {
      console.log('📊 Logging to Application Insights:', {
        error: error.message,
        context: context,
        timestamp: new Date().toISOString()
      });
      
      // Basic logging - you can enhance this with the full Application Insights SDK
      console.error('APP_INSIGHTS_ERROR:', JSON.stringify({
        exception: error.message,
        properties: {
          service: 'email',
          environment: process.env.NODE_ENV,
          appService: process.env.WEBSITE_SITE_NAME,
          resourceGroup: process.env.WEBSITE_RESOURCE_GROUP,
          ...context
        },
        timestamp: new Date().toISOString()
      }));
    } catch (loggingError) {
      console.warn('⚠️ Failed to log to Application Insights:', loggingError.message);
    }
  }
};

/**
 * Create SOAP client with retry mechanism for Azure
 */
const createSoapClientWithRetry = async (url, options, retries = EMAIL_MAX_RETRIES) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`🔄 SOAP client creation attempt ${attempt}/${retries}`);
      console.log(`🔗 Connecting to: ${url}`);
      
      const client = await soap.createClientAsync(url, options);
      console.log('✅ SOAP client created successfully');
      
      // Log successful connection
      logToApplicationInsights(null, {
        operation: 'createSoapClient',
        attempt: attempt,
        success: true,
        url: url
      });
      
      return client;
    } catch (error) {
      console.error(`❌ SOAP client creation attempt ${attempt} failed:`, {
        message: error.message,
        code: error.code,
        stack: error.stack
      });
      
      // Log failed attempt
      logToApplicationInsights(error, {
        operation: 'createSoapClient',
        attempt: attempt,
        success: false,
        url: url
      });
      
      if (attempt === retries) {
        throw new Error(`Failed to create SOAP client after ${retries} attempts: ${error.message}`);
      }
      
      // Wait before retry with exponential backoff
      const delay = options.retryDelay * Math.pow(2, attempt - 1);
      console.log(`⏱️ Waiting ${delay}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

/**
 * Send email with enhanced error handling and retry mechanism
 */
const sendEmailWithRetry = async (client, emailData, retries = 2) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`📤 Email sending attempt ${attempt}/${retries}`);
      console.log('📧 Email data:', { 
        to: emailData.to, 
        subject: emailData.subject,
        bodyLength: emailData.body?.length 
      });
      
      const result = await client.SendMailHTMLAsync(emailData);
      console.log('✅ Email sent successfully:', result);
      
      // Log successful email send
      logToApplicationInsights(null, {
        operation: 'sendEmail',
        attempt: attempt,
        success: true,
        recipient: emailData.to,
        subject: emailData.subject
      });
      
      return result;
    } catch (error) {
      console.error(`❌ Email sending attempt ${attempt} failed:`, {
        message: error.message,
        code: error.code,
        response: error.response?.data
      });
      
      // Log failed attempt
      logToApplicationInsights(error, {
        operation: 'sendEmail',
        attempt: attempt,
        success: false,
        recipient: emailData.to,
        subject: emailData.subject
      });
      
      if (attempt === retries) {
        throw error;
      }
      
      // Wait before retry
      const delay = 3000 * attempt;
      console.log(`⏱️ Waiting ${delay}ms before email retry...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

/**
 * Enhanced send email function for Azure environment
 */
const sendEmail = async (to, subject, body) => {
  let client;
  const startTime = Date.now();
  
  try {
    console.log('🔄 Starting enhanced email sending process...');
    console.log('📧 Email details:', { 
      to, 
      subject: subject.substring(0, 50) + '...',
      serviceUrl: EMAIL_SERVICE_URL,
      environment: process.env.NODE_ENV,
      appService: process.env.WEBSITE_SITE_NAME
    });
    
    // Create SOAP client with retry
    client = await createSoapClientWithRetry(EMAIL_SERVICE_URL, SOAP_OPTIONS);
    
    const emailData = {
      to: to,
      subject: subject,
      body: body
    };

    // Send email with retry
    const result = await sendEmailWithRetry(client, emailData);
    
    const duration = Date.now() - startTime;
    console.log(`✅ Email process completed successfully in ${duration}ms`);
    
    return result;
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('❌ Enhanced email sending failed:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      response: error.response?.data,
      to: to,
      subject: subject,
      duration: `${duration}ms`,
      environment: process.env.NODE_ENV
    });
    
    // Log comprehensive error details
    logToApplicationInsights(error, {
      operation: 'sendEmailComplete',
      success: false,
      recipient: to,
      subject: subject,
      duration: duration,
      serviceUrl: EMAIL_SERVICE_URL
    });
    
    // Provide more specific error messages for common Azure issues
    let errorMessage = error.message;
    
    if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
      errorMessage = 'Email service timeout - this may be due to Azure network restrictions. Please check the email service availability.';
    } else if (error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
      errorMessage = 'Cannot connect to email service - please verify the service URL and network connectivity.';
    } else if (error.message.includes('ECONNRESET')) {
      errorMessage = 'Connection reset by email service - this may be due to Azure SNAT port limitations.';
    } else if (error.message.includes('getaddrinfo')) {
      errorMessage = 'DNS resolution failed - unable to resolve email service hostname.';
    }
    
    throw new Error(errorMessage);
  } finally {
    // Clean up client resources if needed
    if (client && client.httpClient) {
      try {
        client.httpClient.destroy?.();
      } catch (cleanupError) {
        console.warn('⚠️ Error during client cleanup:', cleanupError.message);
      }
    }
  }
};

/**
 * Wrapper function to handle email sending with proper error handling
 */
const safeEmailSend = async (emailFunction, ...args) => {
  try {
    const result = await emailFunction(...args);
    return { success: true, result: result };
  } catch (error) {
    console.error('❌ Email sending failed in safe wrapper:', error);
    
    // Log to Application Insights
    logToApplicationInsights(error, {
      operation: 'safeEmailSend',
      success: false,
      args: args.map((arg, index) => index === 2 ? '[EMAIL_BODY]' : arg) // Hide email body in logs
    });
    
    // Don't throw error to prevent blocking the main functionality
    // Just log and continue
    return { success: false, error: error.message };
  }
};

/**
 * Send notification when new ticket is created
 */
export const notifyTicketCreated = async (ticketData, userData) => {
  console.log('🎫 Starting ticket creation notification...');
  console.log('📋 Ticket data:', { 
    id: ticketData.id, 
    ticket_number: ticketData.ticket_number,
    title: ticketData.title 
  });
  console.log('👤 User data:', { 
    name: userData.name, 
    email: userData.email 
  });
  
  const subject = `New Support Ticket Created - ${ticketData.ticket_number}`;
  
  const body = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px;">
        🎫 New Support Ticket Created
      </h2>
      
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="color: #495057; margin-top: 0;">Ticket Details</h3>
        <p><strong>Ticket Number:</strong> ${ticketData.ticket_number}</p>
        <p><strong>Title:</strong> ${ticketData.title}</p>
        <p><strong>Type:</strong> ${ticketData.type}</p>
        <p><strong>Urgency:</strong> ${ticketData.urgency}</p>
        <p><strong>Status:</strong> ${ticketData.status}</p>
      </div>
      
      <div style="background-color: #e9f7ef; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="color: #495057; margin-top: 0;">Submitted By</h3>
        <p><strong>Name:</strong> ${userData.name}</p>
        <p><strong>Email:</strong> ${userData.email}</p>
      </div>
      
      <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="color: #495057; margin-top: 0;">Description</h3>
        <p style="white-space: pre-wrap;">${ticketData.description}</p>
      </div>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${SYSTEM_URL}" 
           style="background-color: #007bff; color: white; padding: 12px 30px; 
                  text-decoration: none; border-radius: 5px; display: inline-block;">
          🔗 Access Support System
        </a>
      </div>
      
      <p style="color: #6c757d; font-size: 14px; text-align: center; margin-top: 40px;">
        This is an automated notification from the Support Ticket System
      </p>
    </div>
  `;

  console.log('📧 Sending to digital team email:', DIGITAL_TEAM_EMAIL);
  
  const result = await safeEmailSend(sendEmail, DIGITAL_TEAM_EMAIL, subject, body);
  
  if (result.success) {
    console.log('✅ Ticket creation notification sent successfully');
  } else {
    console.error('❌ Ticket creation notification failed:', result.error);
  }
  
  return result;
};

/**
 * Send notification when ticket status is updated with remark
 */
export const notifyTicketUpdated = async (ticketData, remark, newStatus, updatedByUser) => {
  console.log('📝 Starting ticket update notification...');
  console.log('📋 Ticket data:', { 
    id: ticketData.id, 
    ticket_number: ticketData.ticket_number,
    title: ticketData.title,
    created_by_email: ticketData.created_by_email
  });
  
  const subject = `Ticket Update - ${ticketData.ticket_number}`;
  
  const body = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333; border-bottom: 2px solid #28a745; padding-bottom: 10px;">
        📝 Ticket Status Updated
      </h2>
      
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="color: #495057; margin-top: 0;">Ticket Information</h3>
        <p><strong>Ticket Number:</strong> ${ticketData.ticket_number}</p>
        <p><strong>Title:</strong> ${ticketData.title}</p>
        <p><strong>New Status:</strong> <span style="color: #28a745; font-weight: bold;">${newStatus}</span></p>
      </div>
      
      <div style="background-color: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="color: #495057; margin-top: 0;">Update Details</h3>
        <p><strong>Updated by:</strong> ${updatedByUser.name}</p>
        <p><strong>Remarks:</strong></p>
        <div style="background-color: white; padding: 15px; border-left: 4px solid #007bff; margin-top: 10px;">
          <p style="white-space: pre-wrap; margin: 0;">${remark}</p>
        </div>
      </div>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${SYSTEM_URL}/tickets/${ticketData.id}" 
           style="background-color: #28a745; color: white; padding: 12px 30px; 
                  text-decoration: none; border-radius: 5px; display: inline-block;">
          🔗 View Ticket Details
        </a>
      </div>
      
      <p style="color: #6c757d; font-size: 14px; text-align: center; margin-top: 40px;">
        This is an automated notification from the Support Ticket System
      </p>
    </div>
  `;

  console.log('📧 Sending to ticket creator:', ticketData.created_by_email);
  
  const result = await safeEmailSend(sendEmail, ticketData.created_by_email, subject, body);
  
  if (result.success) {
    console.log('✅ Ticket update notification sent successfully');
  } else {
    console.error('❌ Ticket update notification failed:', result.error);
  }
  
  return result;
};

/**
 * Send notification when digital team member creates ticket (needs approval)
 */
export const notifyManagerApproval = async (ticketData, createdByUser) => {
  console.log('⚠️ Starting manager approval notification...');
  console.log('📋 Ticket data:', { 
    id: ticketData.id, 
    ticket_number: ticketData.ticket_number,
    title: ticketData.title 
  });
  
  const subject = `Manager Approval Required - ${ticketData.ticket_number}`;
  
  const body = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333; border-bottom: 2px solid #ffc107; padding-bottom: 10px;">
        ⚠️ Manager Approval Required
      </h2>
      
      <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="color: #856404; margin-top: 0;">🔍 Action Required</h3>
        <p>A digital team member has created a support ticket that requires your approval before it can be processed.</p>
      </div>
      
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="color: #495057; margin-top: 0;">Ticket Details</h3>
        <p><strong>Ticket Number:</strong> ${ticketData.ticket_number}</p>
        <p><strong>Title:</strong> ${ticketData.title}</p>
        <p><strong>Type:</strong> ${ticketData.type}</p>
        <p><strong>Urgency:</strong> ${ticketData.urgency}</p>
        <p><strong>Status:</strong> <span style="color: #ffc107; font-weight: bold;">Pending Approval</span></p>
      </div>
      
      <div style="background-color: #e9f7ef; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="color: #495057; margin-top: 0;">Created By</h3>
        <p><strong>Name:</strong> ${createdByUser.name}</p>
        <p><strong>Email:</strong> ${createdByUser.email}</p>
        <p><strong>Role:</strong> Digital Team Member</p>
      </div>
      
      <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="color: #495057; margin-top: 0;">Description</h3>
        <p style="white-space: pre-wrap;">${ticketData.description}</p>
      </div>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${SYSTEM_URL}/tickets/${ticketData.id}" 
           style="background-color: #ffc107; color: #212529; padding: 12px 30px; 
                  text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
          🔗 Review & Approve Ticket
        </a>
      </div>
      
      <p style="color: #6c757d; font-size: 14px; text-align: center; margin-top: 40px;">
        Please review and approve this ticket to allow the digital team to proceed with the request.
      </p>
    </div>
  `;

  console.log('📧 Sending to digital team email (manager approval):', DIGITAL_TEAM_EMAIL);
  
  const result = await safeEmailSend(sendEmail, DIGITAL_TEAM_EMAIL, subject, body);
  
  if (result.success) {
    console.log('✅ Manager approval notification sent successfully');
  } else {
    console.error('❌ Manager approval notification failed:', result.error);
  }
  
  return result;
};

/**
 * Test email function with enhanced diagnostics
 */
export const testEmail = async (req, res) => {
  try {
    console.log('🧪 Test email endpoint called');
    const { to, subject, message } = req.body;
    
    console.log('📧 Test email parameters:', { to, subject });
    console.log('🌐 Azure environment info:', {
      nodeEnv: process.env.NODE_ENV,
      nodeVersion: process.version,
      websiteName: process.env.WEBSITE_SITE_NAME,
      resourceGroup: process.env.WEBSITE_RESOURCE_GROUP,
      subscriptionId: process.env.WEBSITE_OWNER_NAME,
      emailServiceUrl: EMAIL_SERVICE_URL,
      digitalTeamEmail: DIGITAL_TEAM_EMAIL,
      emailTimeout: EMAIL_TIMEOUT,
      maxRetries: EMAIL_MAX_RETRIES
    });
    
    if (!to || !subject || !message) {
      console.log('❌ Missing required fields');
      return sendError(res, 400, 'Missing required fields: to, subject, message');
    }

    const result = await safeEmailSend(sendEmail, to, subject, message);
    
    if (result.success === false) {
      console.log('❌ Test email failed with safe wrapper');
      return sendError(res, 500, `Failed to send test email: ${result.error}`);
    }
    
    console.log('✅ Test email sent successfully');
    return sendResponse(res, 200, true, 'Test email sent successfully', {
      ...result,
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
      configuration: {
        emailServiceUrl: EMAIL_SERVICE_URL,
        timeout: EMAIL_TIMEOUT,
        maxRetries: EMAIL_MAX_RETRIES
      }
    });
  } catch (error) {
    console.error('❌ Test email endpoint failed:', error);
    
    logToApplicationInsights(error, {
      operation: 'testEmail',
      success: false,
      endpoint: '/api/email/test'
    });
    
    return sendError(res, 500, 'Failed to send test email');
  }
};

/**
 * Azure-specific test email function for debugging
 */
export const testAzureEmail = async (req, res) => {
  try {
    console.log('🧪 Azure-specific email test called');
    console.log('📊 Environment diagnostics:', {
      nodeVersion: process.version,
      platform: process.platform,
      websiteName: process.env.WEBSITE_SITE_NAME,
      resourceGroup: process.env.WEBSITE_RESOURCE_GROUP,
      region: process.env.WEBSITE_RESOURCE_GROUP?.includes('eastasia') ? 'Southeast Asia' : 'Unknown',
      emailServiceUrl: EMAIL_SERVICE_URL,
      digitalTeamEmail: DIGITAL_TEAM_EMAIL,
      timeout: EMAIL_TIMEOUT,
      connectionTimeout: EMAIL_CONNECTION_TIMEOUT,
      maxRetries: EMAIL_MAX_RETRIES,
      retryDelay: EMAIL_RETRY_DELAY,
      applicationInsights: !!process.env.APPLICATIONINSIGHTS_CONNECTION_STRING
    });
    
    const testData = {
      to: req.body.to || DIGITAL_TEAM_EMAIL,
      subject: `Azure Email Test - ${new Date().toISOString()}`,
      message: `
        <h2>Azure App Service Email Test</h2>
        <p>This is a test email sent from Azure App Service.</p>
        <ul>
          <li><strong>Timestamp:</strong> ${new Date().toISOString()}</li>
          <li><strong>Environment:</strong> ${process.env.NODE_ENV}</li>
          <li><strong>App Service:</strong> ${process.env.WEBSITE_SITE_NAME}</li>
          <li><strong>Resource Group:</strong> ${process.env.WEBSITE_RESOURCE_GROUP}</li>
          <li><strong>Node Version:</strong> ${process.version}</li>
          <li><strong>Email Service URL:</strong> ${EMAIL_SERVICE_URL}</li>
          <li><strong>Timeout Configuration:</strong> ${EMAIL_TIMEOUT}ms</li>
          <li><strong>Max Retries:</strong> ${EMAIL_MAX_RETRIES}</li>
        </ul>
        <p>If you receive this email, the email service is working correctly from Azure App Service.</p>
      `
    };
    
    const result = await safeEmailSend(sendEmail, testData.to, testData.subject, testData.message);
    
    const response = {
      success: result.success,
      message: result.success ? 'Azure test email sent successfully' : 'Azure test email failed',
      error: result.error || null,
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
      configuration: {
        emailServiceUrl: EMAIL_SERVICE_URL,
        digitalTeamEmail: DIGITAL_TEAM_EMAIL,
        timeout: EMAIL_TIMEOUT,
        connectionTimeout: EMAIL_CONNECTION_TIMEOUT,
        maxRetries: EMAIL_MAX_RETRIES,
        retryDelay: EMAIL_RETRY_DELAY
      },
      azureInfo: {
        websiteName: process.env.WEBSITE_SITE_NAME,
        resourceGroup: process.env.WEBSITE_RESOURCE_GROUP,
        nodeVersion: process.version,
        platform: process.platform
      }
    };
    
    if (result.success) {
      return sendResponse(res, 200, true, 'Azure test email sent successfully', response);
    } else {
      return sendError(res, 500, `Azure test email failed: ${result.error}`, response);
    }
    
  } catch (error) {
    console.error('❌ Azure email test failed:', error);
    
    logToApplicationInsights(error, {
      operation: 'testAzureEmail',
      success: false,
      endpoint: '/api/email/test-azure'
    });
    
    return sendError(res, 500, 'Azure email test failed', {
      error: error.message,
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString()
    });
  }
};