// emailController.js - Enhanced with better logging
import soap from 'soap';
import { sendResponse, sendError } from '../utils/helpers.js';

const EMAIL_SERVICE_URL = 'https://sg-prod-bdyapp-email.azurewebsites.net/Service.svc?wsdl';
const SYSTEM_URL = 'https://sg-prod-bdyapp-pulsefrontend-g9aqfserb6bea8eq.southeastasia-01.azurewebsites.net/';
const DIGITAL_TEAM_EMAIL = 'BodylineDigitalExcellence@masholdings.com';

/**
 * Create SOAP client and send email
 */
const sendEmail = async (to, subject, body) => {
  try {
    console.log('🔄 Attempting to send email...');
    console.log('📧 Email details:', { to, subject: subject.substring(0, 50) + '...' });
    console.log('🔗 SOAP Service URL:', EMAIL_SERVICE_URL);
    
    const client = await soap.createClientAsync(EMAIL_SERVICE_URL);
    console.log('✅ SOAP client created successfully');
    
    const emailData = {
      to: to,
      subject: subject,
      body: body
    };

    console.log('📤 Sending email with data:', { to: emailData.to, subject: emailData.subject });
    
    const result = await client.SendMailHTMLAsync(emailData);
    console.log('✅ Email sent successfully:', { to, subject, result });
    return result;
  } catch (error) {
    console.error('❌ Email sending failed:', error);
    console.error('❌ Error details:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      response: error.response?.data
    });
    throw error;
  }
};

/**
 * Send notification when new ticket is created
 */
export const notifyTicketCreated = async (ticketData, userData) => {
  try {
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
    await sendEmail(DIGITAL_TEAM_EMAIL, subject, body);
    console.log('✅ Ticket creation notification sent successfully');
    return { success: true };
  } catch (error) {
    console.error('❌ Failed to send ticket creation notification:', error);
    console.error('❌ Full error details:', {
      message: error.message,
      stack: error.stack,
      ticketData,
      userData
    });
    throw error;
  }
};

/**
 * Send notification when ticket status is updated with remark
 */
export const notifyTicketUpdated = async (ticketData, remark, newStatus, updatedByUser) => {
  try {
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
    await sendEmail(ticketData.created_by_email, subject, body);
    console.log('✅ Ticket update notification sent successfully');
    return { success: true };
  } catch (error) {
    console.error('❌ Failed to send ticket update notification:', error);
    console.error('❌ Full error details:', {
      message: error.message,
      stack: error.stack,
      ticketData,
      remark,
      newStatus,
      updatedByUser
    });
    throw error;
  }
};

/**
 * Send notification when digital team member creates ticket (needs approval)
 */
export const notifyManagerApproval = async (ticketData, createdByUser) => {
  try {
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
    await sendEmail(DIGITAL_TEAM_EMAIL, subject, body);
    console.log('✅ Manager approval notification sent successfully');
    return { success: true };
  } catch (error) {
    console.error('❌ Failed to send manager approval notification:', error);
    console.error('❌ Full error details:', {
      message: error.message,
      stack: error.stack,
      ticketData,
      createdByUser
    });
    throw error;
  }
};

/**
 * Test email function
 */
export const testEmail = async (req, res) => {
  try {
    console.log('🧪 Test email endpoint called');
    const { to, subject, message } = req.body;
    
    console.log('📧 Test email parameters:', { to, subject });
    
    if (!to || !subject || !message) {
      console.log('❌ Missing required fields');
      return sendError(res, 400, 'Missing required fields: to, subject, message');
    }

    await sendEmail(to, subject, message);
    console.log('✅ Test email sent successfully');
    return sendResponse(res, 200, true, 'Test email sent successfully');
  } catch (error) {
    console.error('❌ Test email failed:', error);
    return sendError(res, 500, 'Failed to send test email');
  }
};