  //ticketController.js
  import { getDB, sql } from '../config/database.js';
  import { sendResponse, sendError, generateTicketNumber } from '../utils/helpers.js';

  /**
   * Create a new ticket
   */
  export const createTicket = async (req, res) => {
    try {
      const {
        title,
        description,
        category_id,
        subcategory_id,
        subcategory_text,
        software_name,
        system_url,
        type,
        urgency,
        mentioned_support_person
      } = req.body;

      const pool = getDB();
      const ticketNumber = generateTicketNumber();
      
      // Check if user is digital team member (requires approval)
      const requiresApproval = req.user.role === 'digital_team';
      const status = requiresApproval ? 'Pending Approval' : 'Open';

      const request = pool.request();
      
      // Set parameters
      request.input('ticketNumber', sql.NVarChar, ticketNumber);
      request.input('title', sql.NVarChar, title);
      request.input('description', sql.NText, description);
      request.input('categoryId', sql.Int, category_id);
      request.input('subcategoryId', sql.Int, subcategory_id || null);
      request.input('subcategoryText', sql.NVarChar, subcategory_text || null);
      request.input('softwareName', sql.NVarChar, software_name || null);
      request.input('systemUrl', sql.NVarChar, system_url || null);
      request.input('type', sql.NVarChar, type);
      request.input('urgency', sql.NVarChar, urgency);
      request.input('createdBy', sql.Int, req.user.id);
      request.input('mentionedSupportPerson', sql.Int, mentioned_support_person || null);
      request.input('requiresApproval', sql.Bit, requiresApproval);
      request.input('status', sql.NVarChar, status);

      const result = await request.query(`
        INSERT INTO Tickets (
          ticket_number, title, description, category_id, subcategory_id, 
          subcategory_text, software_name, system_url, type, urgency, 
          created_by, mentioned_support_person, requires_manager_approval, status
        ) 
        OUTPUT INSERTED.id, INSERTED.ticket_number, INSERTED.created_at, INSERTED.status
        VALUES (
          @ticketNumber, @title, @description, @categoryId, @subcategoryId,
          @subcategoryText, @softwareName, @systemUrl, @type, @urgency,
          @createdBy, @mentionedSupportPerson, @requiresApproval, @status
        )
      `);

      const newTicket = result.recordset[0];
      
      // Log ticket creation in history
      await logTicketHistory(newTicket.id, req.user.id, 'status', null, status, 'Ticket created');
      
      console.log(`✅ New ticket created: ${ticketNumber} by ${req.user.email}`);
      
      return sendResponse(res, 201, true, 'Ticket created successfully', {
        id: newTicket.id,
        ticket_number: newTicket.ticket_number,
        status: newTicket.status,
        created_at: newTicket.created_at
      });

    } catch (error) {
      console.error('❌ Create ticket error:', error);
      return sendError(res, 500, 'Failed to create ticket');
    }
  };

  /**
   * Get tickets for the logged-in user
   */
  export const getUserTickets = async (req, res) => {
    try {
      const pool = getDB();
      const request = pool.request();
      request.input('userId', sql.Int, req.user.id);
      
      const result = await request.query(`
        SELECT 
          t.id, t.ticket_number, t.title, t.description, t.type, t.urgency, 
          t.status, t.created_at, t.updated_at, t.resolved_at,
          c.name as category_name,
          sc.name as subcategory_name,
          t.subcategory_text, t.software_name, t.system_url,
          u.name as created_by_name,
          a.name as assigned_to_name,
          sp.name as mentioned_support_person_name
        FROM Tickets t
        LEFT JOIN Categories c ON t.category_id = c.id
        LEFT JOIN Subcategories sc ON t.subcategory_id = sc.id
        LEFT JOIN Users u ON t.created_by = u.id
        LEFT JOIN Users a ON t.assigned_to = a.id
        LEFT JOIN SupportPersons sp ON t.mentioned_support_person = sp.id
        WHERE t.created_by = @userId
        ORDER BY t.created_at DESC
      `);
      
      return sendResponse(res, 200, true, 'Tickets retrieved successfully', result.recordset);
      
    } catch (error) {
      console.error('❌ Get user tickets error:', error);
      return sendError(res, 500, 'Failed to retrieve tickets');
    }
  };

  /**
   * Get all tickets (for managers and digital team)
   */
  export const getAllTickets = async (req, res) => {
    try {
      const pool = getDB();
      const request = pool.request();
      
      let query = `
        SELECT 
          t.id, t.ticket_number, t.title, t.description, t.type, t.urgency, 
          t.status, t.created_at, t.updated_at, t.resolved_at,
          t.requires_manager_approval,
          c.name as category_name,
          sc.name as subcategory_name,
          t.subcategory_text, t.software_name, t.system_url,
          u.name as created_by_name, u.email as created_by_email,
          a.name as assigned_to_name,
          sp.name as mentioned_support_person_name
        FROM Tickets t
        LEFT JOIN Categories c ON t.category_id = c.id
        LEFT JOIN Subcategories sc ON t.subcategory_id = sc.id
        LEFT JOIN Users u ON t.created_by = u.id
        LEFT JOIN Users a ON t.assigned_to = a.id
        LEFT JOIN SupportPersons sp ON t.mentioned_support_person = sp.id
      `;
      
      // If digital team member, show only relevant tickets
      if (req.user.role === 'digital_team') {
        request.input('userId', sql.Int, req.user.id);
        query += ` WHERE (t.assigned_to = @userId OR t.assigned_to IS NULL)`;
      }
      
      query += ` ORDER BY t.created_at DESC`;
      
      const result = await request.query(query);
      return sendResponse(res, 200, true, 'All tickets retrieved successfully', result.recordset);
      
    } catch (error) {
      console.error('❌ Get all tickets error:', error);
      return sendError(res, 500, 'Failed to retrieve tickets');
    }
  };

  /**
   * Get single ticket by ID
   */
  export const getTicketById = async (req, res) => {
    try {
      const { id } = req.params;
      const pool = getDB();
      const request = pool.request();
      request.input('ticketId', sql.Int, id);
      
      const result = await request.query(`
        SELECT 
          t.id, t.ticket_number, t.title, t.description, t.type, t.urgency, 
          t.status, t.created_at, t.updated_at, t.resolved_at,
          t.requires_manager_approval, t.approved_at,
          c.name as category_name,
          sc.name as subcategory_name,
          t.subcategory_text, t.software_name, t.system_url,
          u.name as created_by_name, u.email as created_by_email,
          a.name as assigned_to_name,
          sp.name as mentioned_support_person_name,
          ap.name as approved_by_name
        FROM Tickets t
        LEFT JOIN Categories c ON t.category_id = c.id
        LEFT JOIN Subcategories sc ON t.subcategory_id = sc.id
        LEFT JOIN Users u ON t.created_by = u.id
        LEFT JOIN Users a ON t.assigned_to = a.id
        LEFT JOIN SupportPersons sp ON t.mentioned_support_person = sp.id
        LEFT JOIN Users ap ON t.approved_by = ap.id
        WHERE t.id = @ticketId
      `);
      
      if (result.recordset.length === 0) {
        return sendError(res, 404, 'Ticket not found');
      }
      
      const ticket = result.recordset[0];
      
      // Check if user has permission to view this ticket
      const canView = req.user.role === 'manager' || 
                    req.user.role === 'digital_team' || 
                    ticket.created_by_email === req.user.email;
      
      if (!canView) {
        return sendError(res, 403, 'You do not have permission to view this ticket');
      }
      
      return sendResponse(res, 200, true, 'Ticket retrieved successfully', ticket);
      
    } catch (error) {
      console.error('❌ Get ticket by ID error:', error);
      return sendError(res, 500, 'Failed to retrieve ticket');
    }
  };

  /**
   * Update ticket status
   */
  export const updateTicketStatus = async (req, res) => {
    try {
      const { id } = req.params;
      const { status, assigned_to } = req.body;
      
      const pool = getDB();
      const request = pool.request();
      request.input('ticketId', sql.Int, id);
      request.input('status', sql.NVarChar, status);
      request.input('assignedTo', sql.Int, assigned_to || null);
      
      // Build update query
      let updateQuery = `
        UPDATE Tickets 
        SET status = @status, updated_at = GETDATE()
      `;
      
      if (assigned_to) {
        updateQuery += `, assigned_to = @assignedTo`;
      }
      
      if (status === 'Resolved') {
        updateQuery += `, resolved_at = GETDATE()`;
      }
      
      updateQuery += ` WHERE id = @ticketId`;
      
      const result = await request.query(updateQuery);
      
      if (result.rowsAffected[0] === 0) {
        return sendError(res, 404, 'Ticket not found');
      }
      
      // Log the change in history
      await logTicketHistory(id, req.user.id, 'status', null, status, 'Status updated');
      
      if (assigned_to) {
        await logTicketHistory(id, req.user.id, 'assigned_to', null, assigned_to, 'Ticket assigned');
      }
      
      console.log(`✅ Ticket ${id} status updated to ${status} by ${req.user.email}`);
      
      return sendResponse(res, 200, true, 'Ticket status updated successfully');
      
    } catch (error) {
      console.error('❌ Update ticket status error:', error);
      return sendError(res, 500, 'Failed to update ticket status');
    }
  };

  /**
   * Approve ticket (for managers)
   */
  export const approveTicket = async (req, res) => {
    try {
      const { id } = req.params;
      const pool = getDB();
      
      const request = pool.request();
      request.input('ticketId', sql.Int, id);
      request.input('approvedBy', sql.Int, req.user.id);
      
      const result = await request.query(`
        UPDATE Tickets 
        SET status = 'Open', approved_by = @approvedBy, approved_at = GETDATE()
        WHERE id = @ticketId AND requires_manager_approval = 1 AND status = 'Pending Approval'
      `);
      
      if (result.rowsAffected[0] === 0) {
        return sendError(res, 404, 'Ticket not found or not pending approval');
      }
      
      // Log the approval in history
      await logTicketHistory(id, req.user.id, 'status', 'Pending Approval', 'Open', 'Ticket approved');
      
      console.log(`✅ Ticket ${id} approved by ${req.user.email}`);
      
      return sendResponse(res, 200, true, 'Ticket approved successfully');
      
    } catch (error) {
      console.error('❌ Approve ticket error:', error);
      return sendError(res, 500, 'Failed to approve ticket');
    }
  };

  /**
   * Get ticket history
   */
  export const getTicketHistory = async (req, res) => {
    try {
      const { id } = req.params;
      const pool = getDB();
      const request = pool.request();
      request.input('ticketId', sql.Int, id);
      
      const result = await request.query(`
        SELECT 
          th.id, th.field_name, th.old_value, th.new_value, 
          th.change_reason, th.created_at,
          u.name as changed_by_name, u.email as changed_by_email
        FROM TicketHistory th
        LEFT JOIN Users u ON th.changed_by = u.id
        WHERE th.ticket_id = @ticketId
        ORDER BY th.created_at DESC
      `);
      
      return sendResponse(res, 200, true, 'Ticket history retrieved successfully', result.recordset);
      
    } catch (error) {
      console.error('❌ Get ticket history error:', error);
      return sendError(res, 500, 'Failed to retrieve ticket history');
    }
  };

  /**
   * Helper function to log ticket history
   */
  const logTicketHistory = async (ticketId, changedBy, fieldName, oldValue, newValue, changeReason) => {
    try {
      const pool = getDB();
      const request = pool.request();
      request.input('ticketId', sql.Int, ticketId);
      request.input('changedBy', sql.Int, changedBy);
      request.input('fieldName', sql.NVarChar, fieldName);
      request.input('oldValue', sql.NVarChar, oldValue);
      request.input('newValue', sql.NVarChar, newValue);
      request.input('changeReason', sql.NVarChar, changeReason);

      await request.query(`
        INSERT INTO TicketHistory (ticket_id, changed_by, field_name, old_value, new_value, change_reason)
        VALUES (@ticketId, @changedBy, @fieldName, @oldValue, @newValue, @changeReason)
      `);
    } catch (error) {
      console.error('❌ Log ticket history error:', error);
    }
  };