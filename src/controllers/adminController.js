// controllers/adminController.js
import { getDB, sql } from '../config/database.js';
import { sendResponse, sendError } from '../utils/helpers.js';

/**
 * Helper function to log admin actions
 */
const logAdminAction = async (adminUserId, actionType, targetType, targetId, description, targetDetails = null) => {
  try {
    const pool = getDB();
    const request = pool.request();
    request.input('adminUserId', sql.Int, adminUserId);
    request.input('actionType', sql.NVarChar, actionType);
    request.input('targetType', sql.NVarChar, targetType);
    request.input('targetId', sql.Int, targetId);
    request.input('targetDetails', sql.NVarChar, targetDetails);
    request.input('description', sql.NVarChar, description);

    await request.query(`
      INSERT INTO AdminActions (admin_user_id, action_type, target_type, target_id, target_details, action_description)
      VALUES (@adminUserId, @actionType, @targetType, @targetId, @targetDetails, @description)
    `);
  } catch (error) {
    console.error('❌ Log admin action error:', error);
  }
};

/**
 * Check if user has admin privileges
 */
const checkAdminAccess = (user) => {
  return user.role === 'admin' || user.is_admin === true;
};

/**
 * Check if user has specific permission
 */
const hasPermission = (user, permission) => {
  if (!user.permissions) return false;
  const permissions = user.permissions.split(',');
  return permissions.includes(permission);
};

/**
 * Delete a ticket (soft delete)
 */
export const deleteTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    if (!checkAdminAccess(req.user)) {
      return sendError(res, 403, 'Access denied. Admin privileges required.');
    }
    
    if (!hasPermission(req.user, 'delete_tickets')) {
      return sendError(res, 403, 'You do not have permission to delete tickets.');
    }

    const pool = getDB();
    
    // First, check if ticket exists
    const checkRequest = pool.request();
    checkRequest.input('ticketId', sql.Int, id);
    
    const ticketCheck = await checkRequest.query(`
      SELECT id, ticket_number, title FROM Tickets WHERE id = @ticketId
    `);

    if (ticketCheck.recordset.length === 0) {
      return sendError(res, 404, 'Ticket not found');
    }

    const ticket = ticketCheck.recordset[0];

    // Add is_deleted column if it doesn't exist and perform soft delete
    const deleteRequest = pool.request();
    deleteRequest.input('ticketId', sql.Int, id);
    deleteRequest.input('deletedBy', sql.Int, req.user.id);
    deleteRequest.input('reason', sql.NVarChar, reason || 'Deleted by admin');

    // Add is_deleted column if it doesn't exist
    try {
      await deleteRequest.query(`
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Tickets') AND name = 'is_deleted')
        BEGIN
          ALTER TABLE Tickets ADD is_deleted BIT DEFAULT 0
        END
      `);
    } catch (alterError) {
      console.log('Column might already exist:', alterError.message);
    }

    // Perform soft delete
    const result = await deleteRequest.query(`
      UPDATE Tickets 
      SET is_deleted = 1, updated_at = GETDATE()
      WHERE id = @ticketId
    `);

    if (result.rowsAffected[0] === 0) {
      return sendError(res, 500, 'Failed to delete ticket');
    }

    // Log admin action
    await logAdminAction(
      req.user.id,
      'delete_ticket',
      'ticket',
      id,
      `Deleted ticket: ${ticket.ticket_number} - ${ticket.title}`,
      JSON.stringify({ reason, ticket_number: ticket.ticket_number })
    );

    console.log(`✅ Ticket ${id} deleted by admin ${req.user.email}`);
    return sendResponse(res, 200, true, 'Ticket deleted successfully');

  } catch (error) {
    console.error('❌ Delete ticket error:', error);
    return sendError(res, 500, 'Failed to delete ticket');
  }
};

/**
 * Get all support persons (for admin management)
 */
export const getAllSupportPersons = async (req, res) => {
  try {
    if (!checkAdminAccess(req.user)) {
      return sendError(res, 403, 'Access denied. Admin privileges required.');
    }

    const pool = getDB();
    const request = pool.request();
    
    const result = await request.query(`
      SELECT 
        sp.id, sp.name, sp.email, sp.is_active, sp.created_at,
        sp.category_id, c.name as category_name
      FROM SupportPersons sp
      LEFT JOIN Categories c ON sp.category_id = c.id
      ORDER BY c.name, sp.name
    `);

    return sendResponse(res, 200, true, 'Support persons retrieved successfully', result.recordset);

  } catch (error) {
    console.error('❌ Get all support persons error:', error);
    return sendError(res, 500, 'Failed to retrieve support persons');
  }
};

/**
 * Add a new support person
 */
export const addSupportPerson = async (req, res) => {
  try {
    const { name, email, category_id } = req.body;
    
    if (!checkAdminAccess(req.user)) {
      return sendError(res, 403, 'Access denied. Admin privileges required.');
    }
    
    if (!hasPermission(req.user, 'manage_support_persons')) {
      return sendError(res, 403, 'You do not have permission to manage support persons.');
    }

    if (!name || !email || !category_id) {
      return sendError(res, 400, 'Name, email, and category_id are required');
    }

    const pool = getDB();
    const request = pool.request();
    request.input('name', sql.NVarChar, name);
    request.input('email', sql.NVarChar, email);
    request.input('categoryId', sql.Int, parseInt(category_id));

    const result = await request.query(`
      INSERT INTO SupportPersons (name, email, category_id)
      OUTPUT INSERTED.id, INSERTED.name, INSERTED.email, INSERTED.category_id
      VALUES (@name, @email, @categoryId)
    `);

    const newSupportPerson = result.recordset[0];
    
    // Log admin action
    await logAdminAction(
      req.user.id,
      'add_support_person',
      'support_person',
      newSupportPerson.id,
      `Added support person: ${name} (${email})`,
      JSON.stringify({ name, email, category_id })
    );

    console.log(`✅ Support person added: ${name} by admin ${req.user.email}`);
    return sendResponse(res, 201, true, 'Support person added successfully', newSupportPerson);

  } catch (error) {
    console.error('❌ Add support person error:', error);
    if (error.message.includes('duplicate') || error.message.includes('unique') || error.number === 2627) {
      return sendError(res, 409, 'Support person with this email already exists');
    }
    return sendError(res, 500, 'Failed to add support person');
  }
};

/**
 * Update support person
 */
export const updateSupportPerson = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, category_id, is_active } = req.body;
    
    if (!checkAdminAccess(req.user)) {
      return sendError(res, 403, 'Access denied. Admin privileges required.');
    }
    
    if (!hasPermission(req.user, 'manage_support_persons')) {
      return sendError(res, 403, 'You do not have permission to manage support persons.');
    }

    const pool = getDB();
    const request = pool.request();
    request.input('id', sql.Int, parseInt(id));
    request.input('name', sql.NVarChar, name);
    request.input('email', sql.NVarChar, email);
    request.input('categoryId', sql.Int, parseInt(category_id));
    request.input('isActive', sql.Bit, is_active !== undefined ? is_active : true);

    const result = await request.query(`
      UPDATE SupportPersons 
      SET name = @name, email = @email, category_id = @categoryId, is_active = @isActive
      WHERE id = @id
    `);

    if (result.rowsAffected[0] === 0) {
      return sendError(res, 404, 'Support person not found');
    }

    // Log admin action
    await logAdminAction(
      req.user.id,
      'update_support_person',
      'support_person',
      parseInt(id),
      `Updated support person: ${name}`,
      JSON.stringify({ name, email, category_id, is_active })
    );

    console.log(`✅ Support person updated: ${name} by admin ${req.user.email}`);
    return sendResponse(res, 200, true, 'Support person updated successfully');

  } catch (error) {
    console.error('❌ Update support person error:', error);
    return sendError(res, 500, 'Failed to update support person');
  }
};

/**
 * Delete support person
 */
export const deleteSupportPerson = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!checkAdminAccess(req.user)) {
      return sendError(res, 403, 'Access denied. Admin privileges required.');
    }
    
    if (!hasPermission(req.user, 'manage_support_persons')) {
      return sendError(res, 403, 'You do not have permission to manage support persons.');
    }

    const pool = getDB();
    const request = pool.request();
    request.input('id', sql.Int, parseInt(id));

    // First get the support person details for logging
    const selectResult = await request.query(`
      SELECT name, email FROM SupportPersons WHERE id = @id
    `);

    if (selectResult.recordset.length === 0) {
      return sendError(res, 404, 'Support person not found');
    }

    const supportPerson = selectResult.recordset[0];

    // Delete the support person
    const deleteResult = await request.query(`
      DELETE FROM SupportPersons WHERE id = @id
    `);

    // Log admin action
    await logAdminAction(
      req.user.id,
      'delete_support_person',
      'support_person',
      parseInt(id),
      `Deleted support person: ${supportPerson.name} (${supportPerson.email})`,
      JSON.stringify(supportPerson)
    );

    console.log(`✅ Support person deleted: ${supportPerson.name} by admin ${req.user.email}`);
    return sendResponse(res, 200, true, 'Support person deleted successfully');

  } catch (error) {
    console.error('❌ Delete support person error:', error);
    return sendError(res, 500, 'Failed to delete support person');
  }
};

/**
 * Add a new manager
 */
export const addManager = async (req, res) => {
  try {
    const { name, email, department } = req.body;
    
    if (!checkAdminAccess(req.user)) {
      return sendError(res, 403, 'Access denied. Admin privileges required.');
    }
    
    if (!hasPermission(req.user, 'manage_managers')) {
      return sendError(res, 403, 'You do not have permission to manage managers.');
    }

    if (!email) {
      return sendError(res, 400, 'Email is required');
    }

    const pool = getDB();
    const request = pool.request();
    request.input('name', sql.NVarChar, name || email.split('@')[0]);
    request.input('email', sql.NVarChar, email);
    request.input('department', sql.NVarChar, department || null);

    const result = await request.query(`
      INSERT INTO Users (name, email, role, department)
      OUTPUT INSERTED.id, INSERTED.name, INSERTED.email, INSERTED.role
      VALUES (@name, @email, 'manager', @department)
    `);

    const newManager = result.recordset[0];
    
    // Log admin action
    await logAdminAction(
      req.user.id,
      'add_manager',
      'user',
      newManager.id,
      `Added manager: ${newManager.name} (${email})`,
      JSON.stringify({ name: newManager.name, email, department, role: 'manager' })
    );

    console.log(`✅ Manager added: ${newManager.name} by admin ${req.user.email}`);
    return sendResponse(res, 201, true, 'Manager added successfully', newManager);

  } catch (error) {
    console.error('❌ Add manager error:', error);
    if (error.message.includes('duplicate') || error.message.includes('unique') || error.number === 2627) {
      return sendError(res, 409, 'User with this email already exists');
    }
    return sendError(res, 500, 'Failed to add manager');
  }
};

/**
 * Update user role
 */
export const updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, department } = req.body;
    
    if (!checkAdminAccess(req.user)) {
      return sendError(res, 403, 'Access denied. Admin privileges required.');
    }
    
    if (!hasPermission(req.user, 'manage_managers')) {
      return sendError(res, 403, 'You do not have permission to manage users.');
    }

    const pool = getDB();
    const request = pool.request();
    request.input('id', sql.Int, parseInt(id));
    request.input('role', sql.NVarChar, role);
    request.input('department', sql.NVarChar, department || null);

    const result = await request.query(`
      UPDATE Users 
      SET role = @role, department = @department
      WHERE id = @id
    `);

    if (result.rowsAffected[0] === 0) {
      return sendError(res, 404, 'User not found');
    }

    // Log admin action
    await logAdminAction(
      req.user.id,
      'update_user_role',
      'user',
      parseInt(id),
      `Updated user role to: ${role}`,
      JSON.stringify({ role, department })
    );

    console.log(`✅ User role updated by admin ${req.user.email}`);
    return sendResponse(res, 200, true, 'User role updated successfully');

  } catch (error) {
    console.error('❌ Update user role error:', error);
    return sendError(res, 500, 'Failed to update user role');
  }
};

/**
 * Get all categories (for admin management)
 */
export const getAllCategories = async (req, res) => {
  try {
    if (!checkAdminAccess(req.user)) {
      return sendError(res, 403, 'Access denied. Admin privileges required.');
    }

    const pool = getDB();
    const request = pool.request();
    
    const result = await request.query(`
      SELECT id, name, created_at
      FROM Categories 
      ORDER BY name
    `);

    return sendResponse(res, 200, true, 'Categories retrieved successfully', result.recordset);

  } catch (error) {
    console.error('❌ Get all categories error:', error);
    return sendError(res, 500, 'Failed to retrieve categories');
  }
};

/**
 * Add a new category
 */
export const addCategory = async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!checkAdminAccess(req.user)) {
      return sendError(res, 403, 'Access denied. Admin privileges required.');
    }
    
    if (!hasPermission(req.user, 'manage_categories')) {
      return sendError(res, 403, 'You do not have permission to manage categories.');
    }

    if (!name) {
      return sendError(res, 400, 'Category name is required');
    }

    const pool = getDB();
    const request = pool.request();
    request.input('name', sql.NVarChar, name);

    const result = await request.query(`
      INSERT INTO Categories (name)
      OUTPUT INSERTED.id, INSERTED.name
      VALUES (@name)
    `);

    const newCategory = result.recordset[0];
    
    // Log admin action
    await logAdminAction(
      req.user.id,
      'add_category',
      'category',
      newCategory.id,
      `Added category: ${name}`,
      JSON.stringify({ name })
    );

    console.log(`✅ Category added: ${name} by admin ${req.user.email}`);
    return sendResponse(res, 201, true, 'Category added successfully', newCategory);

  } catch (error) {
    console.error('❌ Add category error:', error);
    return sendError(res, 500, 'Failed to add category');
  }
};

/**
 * Update category
 */
export const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    
    if (!checkAdminAccess(req.user)) {
      return sendError(res, 403, 'Access denied. Admin privileges required.');
    }
    
    if (!hasPermission(req.user, 'manage_categories')) {
      return sendError(res, 403, 'You do not have permission to manage categories.');
    }

    const pool = getDB();
    const request = pool.request();
    request.input('id', sql.Int, parseInt(id));
    request.input('name', sql.NVarChar, name);

    const result = await request.query(`
      UPDATE Categories 
      SET name = @name
      WHERE id = @id
    `);

    if (result.rowsAffected[0] === 0) {
      return sendError(res, 404, 'Category not found');
    }

    // Log admin action
    await logAdminAction(
      req.user.id,
      'update_category',
      'category',
      parseInt(id),
      `Updated category: ${name}`,
      JSON.stringify({ name })
    );

    console.log(`✅ Category updated: ${name} by admin ${req.user.email}`);
    return sendResponse(res, 200, true, 'Category updated successfully');

  } catch (error) {
    console.error('❌ Update category error:', error);
    return sendError(res, 500, 'Failed to update category');
  }
};

/**
 * Delete category
 */
export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!checkAdminAccess(req.user)) {
      return sendError(res, 403, 'Access denied. Admin privileges required.');
    }
    
    if (!hasPermission(req.user, 'manage_categories')) {
      return sendError(res, 403, 'You do not have permission to manage categories.');
    }

    const pool = getDB();
    const request = pool.request();
    request.input('id', sql.Int, parseInt(id));

    // First check if category has any tickets
    const ticketCheckResult = await request.query(`
      SELECT COUNT(*) as count FROM Tickets WHERE category_id = @id AND ISNULL(is_deleted, 0) = 0
    `);

    if (ticketCheckResult.recordset[0].count > 0) {
      return sendError(res, 400, 'Cannot delete category with existing tickets');
    }

    // Get category details for logging
    const selectResult = await request.query(`
      SELECT name FROM Categories WHERE id = @id
    `);

    if (selectResult.recordset.length === 0) {
      return sendError(res, 404, 'Category not found');
    }

    const category = selectResult.recordset[0];

    // Delete subcategories first
    await request.query(`DELETE FROM Subcategories WHERE category_id = @id`);
    
    // Delete category
    const deleteResult = await request.query(`DELETE FROM Categories WHERE id = @id`);

    // Log admin action
    await logAdminAction(
      req.user.id,
      'delete_category',
      'category',
      parseInt(id),
      `Deleted category: ${category.name}`,
      JSON.stringify(category)
    );

    console.log(`✅ Category deleted: ${category.name} by admin ${req.user.email}`);
    return sendResponse(res, 200, true, 'Category deleted successfully');

  } catch (error) {
    console.error('❌ Delete category error:', error);
    return sendError(res, 500, 'Failed to delete category');
  }
};

/**
 * Get all subcategories (for admin management)
 */
export const getAllSubcategories = async (req, res) => {
  try {
    if (!checkAdminAccess(req.user)) {
      return sendError(res, 403, 'Access denied. Admin privileges required.');
    }

    const pool = getDB();
    const request = pool.request();
    
    const result = await request.query(`
      SELECT 
        sc.id, sc.name, sc.category_id, sc.requires_text_input, sc.created_at,
        c.name as category_name
      FROM Subcategories sc
      LEFT JOIN Categories c ON sc.category_id = c.id
      ORDER BY c.name, sc.name
    `);

    return sendResponse(res, 200, true, 'Subcategories retrieved successfully', result.recordset);

  } catch (error) {
    console.error('❌ Get all subcategories error:', error);
    return sendError(res, 500, 'Failed to retrieve subcategories');
  }
};

/**
 * Add subcategory
 */
export const addSubcategory = async (req, res) => {
  try {
    const { name, category_id, requires_text_input } = req.body;
    
    if (!checkAdminAccess(req.user)) {
      return sendError(res, 403, 'Access denied. Admin privileges required.');
    }
    
    if (!hasPermission(req.user, 'manage_categories')) {
      return sendError(res, 403, 'You do not have permission to manage categories.');
    }

    if (!name || !category_id) {
      return sendError(res, 400, 'Name and category_id are required');
    }

    const pool = getDB();
    const request = pool.request();
    request.input('name', sql.NVarChar, name);
    request.input('categoryId', sql.Int, parseInt(category_id));
    request.input('requiresTextInput', sql.Bit, requires_text_input || 0);

    const result = await request.query(`
      INSERT INTO Subcategories (name, category_id, requires_text_input)
      OUTPUT INSERTED.id, INSERTED.name, INSERTED.category_id
      VALUES (@name, @categoryId, @requiresTextInput)
    `);

    const newSubcategory = result.recordset[0];
    
    // Log admin action
    await logAdminAction(
      req.user.id,
      'add_subcategory',
      'subcategory',
      newSubcategory.id,
      `Added subcategory: ${name}`,
      JSON.stringify({ name, category_id, requires_text_input })
    );

    console.log(`✅ Subcategory added: ${name} by admin ${req.user.email}`);
    return sendResponse(res, 201, true, 'Subcategory added successfully', newSubcategory);

  } catch (error) {
    console.error('❌ Add subcategory error:', error);
    return sendError(res, 500, 'Failed to add subcategory');
  }
};

/**
 * Update subcategory
 */
export const updateSubcategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category_id, requires_text_input } = req.body;
    
    if (!checkAdminAccess(req.user)) {
      return sendError(res, 403, 'Access denied. Admin privileges required.');
    }
    
    if (!hasPermission(req.user, 'manage_categories')) {
      return sendError(res, 403, 'You do not have permission to manage categories.');
    }

    const pool = getDB();
    const request = pool.request();
    request.input('id', sql.Int, parseInt(id));
    request.input('name', sql.NVarChar, name);
    request.input('categoryId', sql.Int, parseInt(category_id));
    request.input('requiresTextInput', sql.Bit, requires_text_input || 0);

    const result = await request.query(`
      UPDATE Subcategories 
      SET name = @name, category_id = @categoryId, requires_text_input = @requiresTextInput
      WHERE id = @id
    `);

    if (result.rowsAffected[0] === 0) {
      return sendError(res, 404, 'Subcategory not found');
    }

    // Log admin action
    await logAdminAction(
      req.user.id,
      'update_subcategory',
      'subcategory',
      parseInt(id),
      `Updated subcategory: ${name}`,
      JSON.stringify({ name, category_id, requires_text_input })
    );

    console.log(`✅ Subcategory updated: ${name} by admin ${req.user.email}`);
    return sendResponse(res, 200, true, 'Subcategory updated successfully');

  } catch (error) {
    console.error('❌ Update subcategory error:', error);
    return sendError(res, 500, 'Failed to update subcategory');
  }
};

/**
 * Delete subcategory
 */
export const deleteSubcategory = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!checkAdminAccess(req.user)) {
      return sendError(res, 403, 'Access denied. Admin privileges required.');
    }
    
    if (!hasPermission(req.user, 'manage_categories')) {
      return sendError(res, 403, 'You do not have permission to manage categories.');
    }

    const pool = getDB();
    const request = pool.request();
    request.input('id', sql.Int, parseInt(id));

    // Get subcategory details for logging
    const selectResult = await request.query(`
      SELECT name FROM Subcategories WHERE id = @id
    `);

    if (selectResult.recordset.length === 0) {
      return sendError(res, 404, 'Subcategory not found');
    }

    const subcategory = selectResult.recordset[0];

    // Delete subcategory
    const deleteResult = await request.query(`DELETE FROM Subcategories WHERE id = @id`);

    // Log admin action
    await logAdminAction(
      req.user.id,
      'delete_subcategory',
      'subcategory',
      parseInt(id),
      `Deleted subcategory: ${subcategory.name}`,
      JSON.stringify(subcategory)
    );

    console.log(`✅ Subcategory deleted: ${subcategory.name} by admin ${req.user.email}`);
    return sendResponse(res, 200, true, 'Subcategory deleted successfully');

  } catch (error) {
    console.error('❌ Delete subcategory error:', error);
    return sendError(res, 500, 'Failed to delete subcategory');
  }
};

/**
 * Get all users (for admin management)
 */
export const getAllUsers = async (req, res) => {
  try {
    if (!checkAdminAccess(req.user)) {
      return sendError(res, 403, 'Access denied. Admin privileges required.');
    }

    const pool = getDB();
    const request = pool.request();
    
    const result = await request.query(`
      SELECT id, name, email, role, department, is_admin, permissions, created_at, updated_at
      FROM Users 
      ORDER BY role, name
    `);

    return sendResponse(res, 200, true, 'Users retrieved successfully', result.recordset);

  } catch (error) {
    console.error('❌ Get all users error:', error);
    return sendError(res, 500, 'Failed to retrieve users');
  }
};

/**
 * Get admin action logs
 */
export const getAdminLogs = async (req, res) => {
  try {
    if (!checkAdminAccess(req.user)) {
      return sendError(res, 403, 'Access denied. Admin privileges required.');
    }

    const pool = getDB();
    const request = pool.request();
    
    const result = await request.query(`
      SELECT 
        aa.id, aa.action_type, aa.target_type, aa.target_id, 
        aa.target_details, aa.action_description, aa.created_at,
        u.name as admin_name, u.email as admin_email
      FROM AdminActions aa
      LEFT JOIN Users u ON aa.admin_user_id = u.id
      ORDER BY aa.created_at DESC
    `);

    return sendResponse(res, 200, true, 'Admin logs retrieved successfully', result.recordset);

  } catch (error) {
    console.error('❌ Get admin logs error:', error);
    return sendError(res, 500, 'Failed to retrieve admin logs');
  }
};

/**
 * Debug endpoint to check admin access
 */
export const debugAdminAccess = async (req, res) => {
  try {
    console.log('🔍 DEBUG: User object from token:', JSON.stringify(req.user, null, 2));
    
    const user = req.user;
    const isAdmin = user.role === 'admin' || user.is_admin === true;
    const hasPermissions = user.permissions ? user.permissions.split(',') : [];
    
    const debugInfo = {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        is_admin: user.is_admin,
        permissions: user.permissions
      },
      checks: {
        isAdmin: isAdmin,
        hasPermissions: hasPermissions,
        canDeleteTickets: hasPermissions.includes('delete_tickets'),
        canManageCategories: hasPermissions.includes('manage_categories'),
        canManageSupportPersons: hasPermissions.includes('manage_support_persons'),
        canManageManagers: hasPermissions.includes('manage_managers')
      },
      authHeader: req.headers.authorization ? 'Present' : 'Missing',
      tokenInfo: req.headers.authorization ? 'Token exists' : 'No token'
    };
    
    console.log('🔍 DEBUG: Admin check results:', JSON.stringify(debugInfo, null, 2));
    
    return res.json({
      success: true,
      message: 'Debug info for admin access',
      data: debugInfo
    });
    
  } catch (error) {
    console.error('❌ Debug admin access error:', error);
    return res.status(500).json({
      success: false,
      message: 'Debug failed',
      error: error.message
    });
  }
};