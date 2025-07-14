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
    const request = pool.request();
    request.input('ticketId', sql.Int, id);
    request.input('deletedBy', sql.Int, req.user.id);
    request.input('reason', sql.NVarChar, reason || 'Deleted by admin');

    // Execute the stored procedure
    const result = await request.query(`
      EXEC sp_DeleteTicket @TicketId = @ticketId, @DeletedBy = @deletedBy, @Reason = @reason
    `);

    if (result.recordset[0].Status === 'ERROR') {
      return sendError(res, 500, result.recordset[0].Message);
    }

    console.log(`✅ Ticket ${id} deleted by admin ${req.user.email}`);
    return sendResponse(res, 200, true, 'Ticket deleted successfully');

  } catch (error) {
    console.error('❌ Delete ticket error:', error);
    return sendError(res, 500, 'Failed to delete ticket');
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

    const pool = getDB();
    const request = pool.request();
    request.input('name', sql.NVarChar, name);
    request.input('email', sql.NVarChar, email);
    request.input('categoryId', sql.Int, category_id);

    const result = await request.query(`
      INSERT INTO SupportPersons (name, email, category_id)
      OUTPUT INSERTED.id, INSERTED.name, INSERTED.email
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
    if (error.message.includes('duplicate') || error.message.includes('unique')) {
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
    request.input('id', sql.Int, id);
    request.input('name', sql.NVarChar, name);
    request.input('email', sql.NVarChar, email);
    request.input('categoryId', sql.Int, category_id);
    request.input('isActive', sql.Bit, is_active);

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
      id,
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
    request.input('id', sql.Int, id);

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
      id,
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

    const pool = getDB();
    const request = pool.request();
    request.input('name', sql.NVarChar, name);
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
      `Added manager: ${name} (${email})`,
      JSON.stringify({ name, email, department, role: 'manager' })
    );

    console.log(`✅ Manager added: ${name} by admin ${req.user.email}`);
    return sendResponse(res, 201, true, 'Manager added successfully', newManager);

  } catch (error) {
    console.error('❌ Add manager error:', error);
    if (error.message.includes('duplicate') || error.message.includes('unique')) {
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
    request.input('id', sql.Int, id);
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
      id,
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
    request.input('id', sql.Int, id);
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
      id,
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
    request.input('id', sql.Int, id);

    // First check if category has any tickets
    const ticketCheckResult = await request.query(`
      SELECT COUNT(*) as count FROM Tickets WHERE category_id = @id AND is_deleted = 0
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
      id,
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

    const pool = getDB();
    const request = pool.request();
    request.input('name', sql.NVarChar, name);
    request.input('categoryId', sql.Int, category_id);
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
