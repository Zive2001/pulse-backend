import { getDB, sql } from '../config/database.js';
import { sendResponse, sendError } from '../utils/helpers.js';

/**
 * Get all categories with their subcategories
 */
export const getCategories = async (req, res) => {
  try {
    const pool = getDB();
    const request = pool.request();
    
    // Get categories
    const categoriesResult = await request.query(`
      SELECT id, name, created_at
      FROM Categories 
      ORDER BY name
    `);
    
    // Get subcategories
    const subcategoriesResult = await request.query(`
      SELECT id, category_id, name, requires_text_input, created_at
      FROM Subcategories 
      ORDER BY category_id, name
    `);
    
    // Combine categories with their subcategories
    const categories = categoriesResult.recordset.map(category => ({
      ...category,
      subcategories: subcategoriesResult.recordset.filter(
        sub => sub.category_id === category.id
      )
    }));
    
    return sendResponse(res, 200, true, 'Categories retrieved successfully', categories);
    
  } catch (error) {
    console.error('❌ Get categories error:', error);
    return sendError(res, 500, 'Failed to retrieve categories');
  }
};

/**
 * Get support persons by category
 */
export const getSupportPersonsByCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const pool = getDB();
    
    const request = pool.request();
    request.input('categoryId', sql.Int, categoryId);
    
    const result = await request.query(`
      SELECT sp.id, sp.name, sp.email, c.name as category_name
      FROM SupportPersons sp
      INNER JOIN Categories c ON sp.category_id = c.id
      WHERE sp.category_id = @categoryId AND sp.is_active = 1
      ORDER BY sp.name
    `);
    
    return sendResponse(res, 200, true, 'Support persons retrieved successfully', result.recordset);
    
  } catch (error) {
    console.error('❌ Get support persons error:', error);
    return sendError(res, 500, 'Failed to retrieve support persons');
  }
};

/**
 * Get all support persons (for admin purposes)
 */
export const getAllSupportPersons = async (req, res) => {
  try {
    const pool = getDB();
    const request = pool.request();
    
    const result = await request.query(`
      SELECT 
        sp.id, sp.name, sp.email, sp.is_active, sp.created_at,
        c.name as category_name
      FROM SupportPersons sp
      INNER JOIN Categories c ON sp.category_id = c.id
      ORDER BY c.name, sp.name
    `);
    
    return sendResponse(res, 200, true, 'All support persons retrieved successfully', result.recordset);
    
  } catch (error) {
    console.error('❌ Get all support persons error:', error);
    return sendError(res, 500, 'Failed to retrieve support persons');
  }
};
