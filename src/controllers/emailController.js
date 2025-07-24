// emailController.js - Enhanced with CC functionality using multiple emails
import soap from 'soap';
import { sendResponse, sendError } from '../utils/helpers.js';
import http from 'http';
import https from 'https';

// Environment-based configuration
const EMAIL_SERVICE_URL = process.env.EMAIL_SERVICE_URL || 'https://sg-prod-bdyapp-email.azurewebsites.net/Service.svc?wsdl';
const SYSTEM_URL = process.env.CORS_ORIGIN?.split(',')[0] || 'https://sg-prod-bdyapp-pulsefrontend-g9aqfserb6bea8eq.southeastasia-01.azurewebsites.net/';
const DIGITAL_TEAM_EMAIL = process.env.DIGITAL_TEAM_EMAIL || 'BodylineDigitalExcellence@masholdings.com';

// TODO: Replace with API endpoint to get manager email dynamically
const MANAGER_EMAIL = 'gayankar@masholdings.com';

// Timeout and retry configuration from environment
const EMAIL_TIMEOUT = parseInt(process.env.EMAIL_TIMEOUT) || 90000;
const EMAIL_CONNECTION_TIMEOUT = parseInt(process.env.EMAIL_CONNECTION_TIMEOUT) || 30000;
const EMAIL_MAX_RETRIES = parseInt(process.env.EMAIL_MAX_RETRIES) || 3;
const EMAIL_RETRY_DELAY = parseInt(process.env.EMAIL_RETRY_DELAY) || 2000;

/**
 * Professional email template wrapper - Modern minimalistic design inspired by RIOT Games
 */
const createEmailTemplate = (title, content, primaryColor = '#023047') => {
  return `
    <!DOCTYPE html>
    <html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <title>${title}</title>
        <!--[if gte mso 9]>
        <xml>
            <o:OfficeDocumentSettings>
                <o:AllowPNG/>
                <o:PixelsPerInch>96</o:PixelsPerInch>
            </o:OfficeDocumentSettings>
        </xml>
        <![endif]-->
        <style>
            /* Reset and Outlook compatibility */
            table {
                border-collapse: collapse;
                mso-table-lspace: 0pt;
                mso-table-rspace: 0pt;
            }
            
            .ReadMsgBody { width: 100%; }
            .ExternalClass { width: 100%; }
            .ExternalClass * { line-height: 100%; }
            
            body {
                margin: 0 !important;
                padding: 0 !important;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
                line-height: 1.5;
                color: #1a1a1a;
                background-color: #ffffff;
                -webkit-text-size-adjust: 100%;
                -ms-text-size-adjust: 100%;
            }
            
            .email-container {
                max-width: 580px;
                margin: 0 auto;
                background-color: #ffffff;
            }
            
            /* Modern header styling */
            .email-header {
                background-color: #ffffff;
                padding: 48px 40px 32px;
                text-align: left;
                border-bottom: 1px solid #f0f0f0;
            }
            
            .email-header h1 {
                color: #023047;
                font-size: 32px;
                font-weight: 600;
                margin: 0;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
                line-height: 1.2;
                letter-spacing: -0.02em;
            }
            
            .email-body {
                padding: 40px;
                background-color: #ffffff;
            }
            
            /* Clean section styling */
            .section {
                margin: 32px 0;
                padding: 0;
            }
            
            .section:first-child {
                margin-top: 0;
            }
            
            .section-title {
                color: #023047;
                font-size: 16px;
                font-weight: 600;
                margin: 0 0 16px 0;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
                letter-spacing: -0.01em;
            }
            
            .section-content {
                background-color: #fafafa;
                border: 1px solid #f0f0f0;
                border-radius: 8px;
                padding: 24px;
            }
            
            .section-content p {
                margin: 8px 0;
                color: #4a4a4a;
                font-size: 14px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
                line-height: 1.5;
            }
            
            .section-content strong {
                color: #1a1a1a;
                font-weight: 600;
            }
            
            /* Status badges */
            .status-badge {
                display: inline-block;
                padding: 4px 12px;
                border-radius: 16px;
                font-size: 12px;
                font-weight: 500;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
            }
            
            .status-pending {
                background-color: #fff3cd;
                color: #856404;
            }
            
            .status-approved {
                background-color: #d4edda;
                color: #155724;
            }
            
            .status-updated {
                background-color: #cce5ff;
                color: #004085;
            }
            
            /* Description styling */
            .description-box {
                background-color: #ffffff;
                border: 1px solid #e8e8e8;
                border-radius: 6px;
                padding: 20px;
                margin: 12px 0;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
                color: #4a4a4a;
                line-height: 1.6;
                font-size: 14px;
            }
            
            /* Copy indicator - subtle text only */
            .copy-indicator {
                color: #2a9d8f;
                font-size: 13px;
                font-weight: 500;
                margin: 0 0 24px 0;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
                padding: 0;
                background: none;
            }
            
            /* Modern button styling */
            .action-container {
                text-align: center;
                padding: 40px 0 20px;
                margin-top: 40px;
            }
            
            .btn {
                display: inline-block;
                background-color: #023047;
                color: #ffffff;
                padding: 16px 32px;
                text-decoration: none;
                border-radius: 6px;
                font-weight: 600;
                font-size: 14px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
                letter-spacing: 0.01em;
                transition: background-color 0.2s ease;
            }
            
            .btn:hover {
                background-color: #034663;
            }
            
            .btn-success {
                background-color: #2a9d8f;
            }
            
            .btn-success:hover {
                background-color: #238a7a;
            }
            
            .btn-warning {
                background-color: #f59e0b;
            }
            
            .btn-warning:hover {
                background-color: #d97706;
            }
            
            /* Modern footer */
            .footer {
                background-color: #fafafa;
                padding: 32px 40px;
                text-align: center;
                border-top: 1px solid #f0f0f0;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
            }
            
            .footer p {
                color: #8a8a8a;
                font-size: 13px;
                margin: 4px 0;
                line-height: 1.4;
            }
            
            /* Responsive design */
            @media only screen and (max-width: 600px) {
                .email-header,
                .email-body,
                .footer {
                    padding-left: 24px !important;
                    padding-right: 24px !important;
                }
                
                .email-header h1 {
                    font-size: 24px !important;
                }
                
                .section-content {
                    padding: 20px !important;
                }
                
                .btn {
                    padding: 14px 28px !important;
                    font-size: 13px !important;
                }
            }
        </style>
    </head>
    <body>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #ffffff;">
            <tr>
                <td align="center" valign="top">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="580" class="email-container" style="background-color: #ffffff;">
                        ${content}
                        <tr>
                            <td class="footer">
                                <p>This is an automated notification from Bodyline Pulse Support System</p>
                                <p>© ${new Date().getFullYear()} Bodyline Digital Excellence. All rights reserved.</p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
  `;
};

/**
 * Log to Application Insights if available
 */
const logToApplicationInsights = (error, context) => {
  if (process.env.APPLICATIONINSIGHTS_CONNECTION_STRING) {
    try {
      console.log('📊 Logging to Application Insights:', {
        error: error?.message,
        context: context,
        timestamp: new Date().toISOString()
      });
      
      // Basic logging - you can enhance this with the full Application Insights SDK
      console.error('APP_INSIGHTS_ERROR:', JSON.stringify({
        exception: error?.message,
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
 * Create SOAP client with Azure-compatible configuration
 */
const createSoapClientWithRetry = async (url, retries = EMAIL_MAX_RETRIES) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`🔄 SOAP client creation attempt ${attempt}/${retries}`);
      console.log(`🔗 Connecting to: ${url}`);
      
      // Azure-compatible SOAP options - simplified for better compatibility
      const soapOptions = {
        timeout: EMAIL_TIMEOUT,
        connection_timeout: EMAIL_CONNECTION_TIMEOUT,
        // Remove custom HTTP agents that cause issues in Azure
        // The soap library will use default HTTP handling
        wsdl_headers: {
          'User-Agent': 'NodeJS-SOAP-Client',
          'Connection': 'close' // Use close instead of keep-alive to avoid connection issues
        },
        // Force HTTPS for Azure
        forceSoap12: false,
        useEmptyTag: true
      };

      const client = await soap.createClientAsync(url, soapOptions);
      console.log('✅ SOAP client created successfully');
      
      // Verify the client has the expected methods
      if (!client.SendMailHTMLAsync) {
        console.log('📋 Available methods:', Object.keys(client));
        throw new Error('SendMailHTMLAsync method not found on SOAP client');
      }
      
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
      const delay = EMAIL_RETRY_DELAY * Math.pow(2, attempt - 1);
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
      
      // Call the SOAP method
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
const sendEmail = async (to, subject, body, isCopy = false) => {
  let client;
  const startTime = Date.now();
  
  try {
    console.log('🔄 Starting enhanced email sending process...');
    console.log('📧 Email details:', { 
      to, 
      subject: subject.substring(0, 50) + '...',
      isCopy,
      serviceUrl: EMAIL_SERVICE_URL,
      environment: process.env.NODE_ENV,
      appService: process.env.WEBSITE_SITE_NAME
    });
    
    // Create SOAP client with retry
    client = await createSoapClientWithRetry(EMAIL_SERVICE_URL);
    
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
    } else if (error.message.includes('httpClient.request is not a function')) {
      errorMessage = 'SOAP client configuration error - HTTP client incompatibility in Azure environment.';
    }
    
    throw new Error(errorMessage);
  } finally {
    // Clean up client resources if needed
    if (client && typeof client.destroy === 'function') {
      try {
        client.destroy();
      } catch (cleanupError) {
        console.warn('⚠️ Error during client cleanup:', cleanupError.message);
      }
    }
  }
};

/**
 * Send email with CC functionality using multiple individual emails
 */
const sendEmailWithCC = async (to, ccList, subject, body) => {
  const results = [];
  
  try {
    console.log('📧 Starting CC email sending process...');
    console.log('📬 Recipients:', { to, ccList, subject: subject.substring(0, 50) + '...' });
    
    // Send primary email to main recipient
    console.log('📤 Sending primary email to:', to);
    const primaryResult = await safeEmailSend(sendEmail, to, subject, body, false);
    results.push({ 
      recipient: to, 
      type: 'primary', 
      success: primaryResult.success, 
      error: primaryResult.error 
    });
    
    // Send copy emails to CC recipients
    if (ccList && ccList.length > 0) {
      for (const ccRecipient of ccList) {
        // Skip if CC recipient is the same as primary recipient
        if (ccRecipient === to) {
          console.log(`⏭️ Skipping CC for ${ccRecipient} (same as primary recipient)`);
          continue;
        }
        
        console.log('📋 Sending copy email to:', ccRecipient);
        const ccSubject = `[COPY] ${subject}`;
        
        // Add CC indicator to the email body
        const ccBody = createEmailTemplate(ccSubject, `
          <tr>
              <td class="email-header">
                  <h1>Email Copy</h1>
              </td>
          </tr>
          <tr>
              <td class="email-body">
                  <p class="copy-indicator">📋 This is a copy of the email sent to: ${to}</p>
                  ${body.replace(/<tr>\s*<td class="email-header">[\s\S]*?<\/td>\s*<\/tr>\s*<tr>\s*<td class="email-body">/, '').replace(/<\/td>\s*<\/tr>\s*<\/table>\s*<\/td>\s*<\/tr>\s*<\/table>\s*<\/body>\s*<\/html>$/, '')}
              </td>
          </tr>
        `);
        
        const ccResult = await safeEmailSend(sendEmail, ccRecipient, ccSubject, ccBody, true);
        results.push({ 
          recipient: ccRecipient, 
          type: 'cc', 
          success: ccResult.success, 
          error: ccResult.error 
        });
        
        // Small delay between CC emails to avoid overwhelming the email service
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // Determine overall success
    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;
    const overallSuccess = successCount > 0; // Consider success if at least one email sent
    
    console.log(`📊 Email sending summary: ${successCount}/${totalCount} emails sent successfully`);
    
    return {
      success: overallSuccess,
      results: results,
      summary: {
        total: totalCount,
        successful: successCount,
        failed: totalCount - successCount
      }
    };
    
  } catch (error) {
    console.error('❌ CC email sending failed:', error);
    
    logToApplicationInsights(error, {
      operation: 'sendEmailWithCC',
      success: false,
      recipients: { to, ccList }
    });
    
    return {
      success: false,
      error: error.message,
      results: results
    };
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
    email: userData.email,
    role: userData.role
  });
  
  const subject = `New Support Ticket Created - ${ticketData.ticket_number}`;
  
  const content = `
    <tr>
        <td class="email-header">
            <h1>New Support Ticket Created</h1>
        </td>
    </tr>
    <tr>
        <td class="email-body">
            <div class="section">
                <h3 class="section-title">Ticket Information</h3>
                <div class="section-content">
                    <p><strong>Ticket Number:</strong> ${ticketData.ticket_number}</p>
                    <p><strong>Title:</strong> ${ticketData.title}</p>
                    <p><strong>Type:</strong> ${ticketData.type}</p>
                    <p><strong>Urgency:</strong> <span class="status-badge status-pending">${ticketData.urgency}</span></p>
                    <p><strong>Status:</strong> <span class="status-badge status-updated">${ticketData.status}</span></p>
                </div>
            </div>
            
            <div class="section">
                <h3 class="section-title">Submitted By</h3>
                <div class="section-content">
                    <p><strong>Name:</strong> ${userData.name}</p>
                    <p><strong>Email:</strong> ${userData.email}</p>
                    <p><strong>Role:</strong> ${userData.role || 'User'}</p>
                </div>
            </div>
            
            <div class="section">
                <h3 class="section-title">Description</h3>
                <div class="description-box">${ticketData.description}</div>
            </div>
            
            <div class="action-container">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;">
                    <tr>
                        <td>
                            <a href="${SYSTEM_URL}" class="btn" style="background-color: #023047; color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 6px; font-weight: 600; font-size: 14px; display: inline-block;">
                                Access Bodyline Pulse
                            </a>
                        </td>
                    </tr>
                </table>
            </div>
        </td>
    </tr>
  `;

  const body = createEmailTemplate(subject, content);

  // Determine CC recipients based on user role
  let ccList = [];
  
  // For regular users: CC the ticket creator so they get a copy
  if (userData.role !== 'digital_team' && userData.role !== 'manager') {
    ccList.push(userData.email);
    console.log('📋 Adding ticket creator to CC:', userData.email);
  }
  
  console.log('📧 Sending to digital team email:', DIGITAL_TEAM_EMAIL);
  console.log('📋 CC recipients:', ccList);
  
  const result = await sendEmailWithCC(DIGITAL_TEAM_EMAIL, ccList, subject, body);
  
  if (result.success) {
    console.log('✅ Ticket creation notification sent successfully');
    console.log('📊 Email summary:', result.summary);
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
  console.log('👤 Updated by:', { 
    name: updatedByUser.name, 
    email: updatedByUser.email 
  });
  
  const subject = `Ticket Update - ${ticketData.ticket_number}`;
  
  const content = `
    <tr>
        <td class="email-header">
            <h1>Ticket Status Updated</h1>
        </td>
    </tr>
    <tr>
        <td class="email-body">
            <div class="section">
                <h3 class="section-title">Ticket Information</h3>
                <div class="section-content">
                    <p><strong>Ticket Number:</strong> ${ticketData.ticket_number}</p>
                    <p><strong>Title:</strong> ${ticketData.title}</p>
                    <p><strong>New Status:</strong> <span class="status-badge status-approved">${newStatus}</span></p>
                </div>
            </div>
            
            <div class="section">
                <h3 class="section-title">Update Details</h3>
                <div class="section-content">
                    <p><strong>Updated by:</strong> ${updatedByUser.name}</p>
                    <p><strong>Remarks:</strong></p>
                    <div class="description-box">${remark}</div>
                </div>
            </div>
            
            <div class="action-container">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;">
                    <tr>
                        <td>
                            <a href="${SYSTEM_URL}/tickets/${ticketData.id}" class="btn btn-success" style="background-color: #2a9d8f; color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 6px; font-weight: 600; font-size: 14px; display: inline-block;">
                                View Ticket Details
                            </a>
                        </td>
                    </tr>
                </table>
            </div>
        </td>
    </tr>
  `;

  const body = createEmailTemplate(subject, content, '#2a9d8f');

  // CC the person who made the update (so they get a copy of what was sent)
  let ccList = [];
  if (updatedByUser.email && updatedByUser.email !== ticketData.created_by_email) {
    ccList.push(updatedByUser.email);
    console.log('📋 Adding updater to CC:', updatedByUser.email);
  }

  console.log('📧 Sending to ticket creator:', ticketData.created_by_email);
  console.log('📋 CC recipients:', ccList);
  
  const result = await sendEmailWithCC(ticketData.created_by_email, ccList, subject, body);
  
  if (result.success) {
    console.log('✅ Ticket update notification sent successfully');
    console.log('📊 Email summary:', result.summary);
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
  console.log('👤 Created by:', { 
    name: createdByUser.name, 
    email: createdByUser.email 
  });
  
  const subject = `Manager Approval Required - ${ticketData.ticket_number}`;
  
  const content = `
    <tr>
        <td class="email-header">
            <h1>Manager Approval Required</h1>
        </td>
    </tr>
    <tr>
        <td class="email-body">
            <div class="section">
                <h3 class="section-title">Action Required</h3>
                <div class="section-content">
                    <p>A digital team member has created a support ticket that requires your approval before it can be processed.</p>
                </div>
            </div>
            
            <div class="section">
                <h3 class="section-title">Ticket Details</h3>
                <div class="section-content">
                    <p><strong>Ticket Number:</strong> ${ticketData.ticket_number}</p>
                    <p><strong>Title:</strong> ${ticketData.title}</p>
                    <p><strong>Type:</strong> ${ticketData.type}</p>
                    <p><strong>Urgency:</strong> <span class="status-badge status-pending">${ticketData.urgency}</span></p>
                    <p><strong>Status:</strong> <span class="status-badge status-pending">Pending Approval</span></p>
                </div>
            </div>
            
            <div class="section">
                <h3 class="section-title">Created By</h3>
                <div class="section-content">
                    <p><strong>Name:</strong> ${createdByUser.name}</p>
                    <p><strong>Email:</strong> ${createdByUser.email}</p>
                    <p><strong>Role:</strong> Digital Team Member</p>
                </div>
            </div>
            
            <div class="section">
                <h3 class="section-title">Description</h3>
                <div class="description-box">${ticketData.description}</div>
            </div>
            
            <div class="action-container">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;">
                    <tr>
                        <td>
                            <a href="${SYSTEM_URL}/tickets/${ticketData.id}" class="btn btn-warning" style="background-color: #f59e0b; color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 6px; font-weight: 600; font-size: 14px; display: inline-block;">
                                Review & Approve Ticket
                            </a>
                        </td>
                    </tr>
                </table>
            </div>
        </td>
    </tr>
  `;

  const body = createEmailTemplate(subject, content, '#f59e0b');

  // CC the digital team member who created the ticket (so they get a copy)
  let ccList = [];
  if (createdByUser.email) {
    ccList.push(createdByUser.email);
    console.log('📋 Adding ticket creator to CC:', createdByUser.email);
  }

  // Send to manager for approval
  console.log('📧 Sending to manager email:', MANAGER_EMAIL);
  console.log('📋 CC recipients:', ccList);
  
  const result = await sendEmailWithCC(MANAGER_EMAIL, ccList, subject, body);
  
  if (result.success) {
    console.log('✅ Manager approval notification sent successfully');
    console.log('📊 Email summary:', result.summary);
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
      managerEmail: MANAGER_EMAIL,
      emailTimeout: EMAIL_TIMEOUT,
      maxRetries: EMAIL_MAX_RETRIES
    });
    
    if (!to || !subject || !message) {
      console.log('❌ Missing required fields');
      return sendError(res, 400, 'Missing required fields: to, subject, message');
    }

    // Create professional test email template
    const testContent = `
      <tr>
          <td class="email-header">
              <h1>Test Email</h1>
          </td>
      </tr>
      <tr>
          <td class="email-body">
              <div class="section">
                  <h3 class="section-title">Test Message</h3>
                  <div class="description-box">${message}</div>
              </div>
              
              <div class="section">
                  <h3 class="section-title">System Information</h3>
                  <div class="section-content">
                      <p><strong>Environment:</strong> ${process.env.NODE_ENV || 'Development'}</p>
                      <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
                      <p><strong>App Service:</strong> ${process.env.WEBSITE_SITE_NAME || 'Local'}</p>
                      <p><strong>Node Version:</strong> ${process.version}</p>
                  </div>
              </div>
              
              <div class="action-container">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;">
                      <tr>
                          <td>
                              <a href="${SYSTEM_URL}" class="btn" style="background-color: #023047; color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 6px; font-weight: 600; font-size: 14px; display: inline-block;">
                                  Access Bodyline Pulse
                              </a>
                          </td>
                      </tr>
                  </table>
              </div>
          </td>
      </tr>
    `;

    const testBody = createEmailTemplate(subject, testContent);
    const result = await safeEmailSend(sendEmail, to, subject, testBody);
    
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
      managerEmail: MANAGER_EMAIL,
      timeout: EMAIL_TIMEOUT,
      connectionTimeout: EMAIL_CONNECTION_TIMEOUT,
      maxRetries: EMAIL_MAX_RETRIES,
      retryDelay: EMAIL_RETRY_DELAY,
      applicationInsights: !!process.env.APPLICATIONINSIGHTS_CONNECTION_STRING
    });
    
    const testData = {
      to: req.body.to || DIGITAL_TEAM_EMAIL,
      subject: `Azure Email Test - ${new Date().toISOString()}`,
      message: `Azure App Service Email Test - This is a comprehensive test email sent from Azure App Service to verify email functionality.`
    };
    
    // Create professional Azure test email template
    const azureTestContent = `
      <tr>
          <td class="email-header">
              <h1>Azure Email Service Test</h1>
          </td>
      </tr>
      <tr>
          <td class="email-body">
              <div class="section">
                  <h3 class="section-title">Test Status</h3>
                  <div class="section-content">
                      <p>This email was successfully sent from Azure App Service, confirming that the email service is operational.</p>
                  </div>
              </div>
              
              <div class="section">
                  <h3 class="section-title">Environment Details</h3>
                  <div class="section-content">
                      <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
                      <p><strong>Environment:</strong> ${process.env.NODE_ENV || 'Development'}</p>
                      <p><strong>App Service:</strong> ${process.env.WEBSITE_SITE_NAME || 'Local'}</p>
                      <p><strong>Resource Group:</strong> ${process.env.WEBSITE_RESOURCE_GROUP || 'Local'}</p>
                      <p><strong>Node Version:</strong> ${process.version}</p>
                      <p><strong>Platform:</strong> ${process.platform}</p>
                  </div>
              </div>
              
              <div class="section">
                  <h3 class="section-title">Email Configuration</h3>
                  <div class="section-content">
                      <p><strong>Service URL:</strong> ${EMAIL_SERVICE_URL}</p>
                      <p><strong>Timeout:</strong> ${EMAIL_TIMEOUT}ms</p>
                      <p><strong>Connection Timeout:</strong> ${EMAIL_CONNECTION_TIMEOUT}ms</p>
                      <p><strong>Max Retries:</strong> ${EMAIL_MAX_RETRIES}</p>
                      <p><strong>Retry Delay:</strong> ${EMAIL_RETRY_DELAY}ms</p>
                  </div>
              </div>
              
              <div class="action-container">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;">
                      <tr>
                          <td>
                              <a href="${SYSTEM_URL}" class="btn" style="background-color: #023047; color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 6px; font-weight: 600; font-size: 14px; display: inline-block;">
                                  Access Bodyline Pulse
                              </a>
                          </td>
                      </tr>
                  </table>
              </div>
          </td>
      </tr>
    `;

    const azureTestBody = createEmailTemplate(testData.subject, azureTestContent);
    
    // Test CC functionality if requested
    const testCC = req.body.testCC === true;
    const ccRecipients = req.body.ccList || [];
    
    let result;
    
    if (testCC && ccRecipients.length > 0) {
      console.log('🧪 Testing CC functionality with recipients:', ccRecipients);
      result = await sendEmailWithCC(testData.to, ccRecipients, testData.subject, azureTestBody);
    } else {
      result = await safeEmailSend(sendEmail, testData.to, testData.subject, azureTestBody);
    }
    
    const response = {
      success: result.success,
      message: result.success ? 'Azure test email sent successfully' : 'Azure test email failed',
      error: result.error || null,
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
      configuration: {
        emailServiceUrl: EMAIL_SERVICE_URL,
        digitalTeamEmail: DIGITAL_TEAM_EMAIL,
        managerEmail: MANAGER_EMAIL,
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
      },
      ccTest: testCC ? {
        enabled: true,
        recipients: ccRecipients,
        results: result.results || null,
        summary: result.summary || null
      } : { enabled: false }
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