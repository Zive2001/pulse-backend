// emailController.js - Enhanced for Azure App Service compatibility
import soap from 'soap';
import { sendResponse, sendError } from '../utils/helpers.js';
import http from 'http';
import https from 'https';

const EMAIL_SERVICE_URL = 'https://sg-prod-bdyapp-email.azurewebsites.net/Service.svc?wsdl';
const SYSTEM_URL = 'https://sg-prod-bdyapp-pulsefrontend-g9aqfserb6bea8eq.southeastasia-01.azurewebsites.net/';
const DIGITAL_TEAM_EMAIL = 'BodylineDigitalExcellence@masholdings.com';

// Configure HTTP agents for better connection management in Azure
const httpAgent = new http.Agent({
  keepAlive: true,
  keepAliveMsecs: 30000,
  maxSockets: 5,
  maxFreeSockets: 2,
  timeout: 60000
});

const httpsAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 30000,
  maxSockets: 5,
  maxFreeSockets: 2,
  timeout: 60000
});

// SOAP client options optimized for Azure
const SOAP_OPTIONS = {
  timeout: 90000, // 90 seconds timeout
  connection_timeout: 30000, // 30 seconds connection timeout
  httpClient: {
    httpAgent: httpAgent,
    httpsAgent: httpsAgent,
    timeout: 90000
  },
  request: {
    timeout: 90000,
    headers: {
      'User-Agent': 'AzureAppService-EmailClient/1.0',
      'Connection': 'keep-alive',
      'Keep-Alive': 'timeout=60'
    }
  },
  // Add retry mechanism
  maxRetries: 3,
  retryDelay: 2000
};

/**
 * Create SOAP client with retry mechanism for Azure
 */
const createSoapClientWithRetry = async (url, options, retries = 3) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`🔄 SOAP client creation attempt ${attempt}/${retries}`);
      const client = await soap.createClientAsync(url, options);
      console.log('✅ SOAP client created successfully');
      return client;
    } catch (error) {
      console.error(`❌ SOAP client creation attempt ${attempt} failed:`, error.message);
      
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
      return result;
    } catch (error) {
      console.error(`❌ Email sending attempt ${attempt} failed:`, {
        message: error.message,
        code: error.code,
        response: error.response?.data
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
  try {
    console.log('🔄 Starting enhanced email sending process...');
    console.log('📧 Email details:', { 
      to, 
      subject: subject.substring(0, 50) + '...',
      serviceUrl: EMAIL_SERVICE_URL 
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
    
    console.log('✅ Email process completed successfully');
    return result;
    
  } catch (error) {
    console.error('❌ Enhanced email sending failed:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      response: error.response?.data,
      to: to,
      subject: subject
    });
    
    // Provide more specific error messages for common Azure issues
    let errorMessage = error.message;
    
    if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
      errorMessage = 'Email service timeout - this may be due to Azure network restrictions. Please check the email service availability.';
    } else if (error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
      errorMessage = 'Cannot connect to email service - please verify the service URL and network connectivity.';
    } else if (error.message.includes('ECONNRESET')) {
      errorMessage = 'Connection reset by email service - this may be due to Azure SNAT port limitations.';
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
    return await emailFunction(...args);
  } catch (error) {
    console.error('❌ Email sending failed in safe wrapper:', error);
    
    // Log to Application Insights or Azure Monitor if available
    if (process.env.APPLICATIONINSIGHTS_CONNECTION_STRING) {
      console.log('📊 Logging email failure to Application Insights');
      // You can add Application Insights logging here if needed
    }
    
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
  
  return await safeEmailSend(async () => {
    await sendEmail(DIGITAL_TEAM_EMAIL, subject, body);
    console.log('✅ Ticket creation notification sent successfully');
    return { success: true };
  });
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
  
  return await safeEmailSend(async () => {
    await sendEmail(ticketData.created_by_email, subject, body);
    console.log('✅ Ticket update notification sent successfully');
    return { success: true };
  });
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
  
  return await safeEmailSend(async () => {
    await sendEmail(DIGITAL_TEAM_EMAIL, subject, body);
    console.log('✅ Manager approval notification sent successfully');
    return { success: true };
  });
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
      websiteName: process.env.WEBSITE_SITE_NAME,
      resourceGroup: process.env.WEBSITE_RESOURCE_GROUP,
      subscriptionId: process.env.WEBSITE_OWNER_NAME
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
    return sendResponse(res, 200, true, 'Test email sent successfully', result);
  } catch (error) {
    console.error('❌ Test email endpoint failed:', error);
    return sendError(res, 500, 'Failed to send test email');
  }
};