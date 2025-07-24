//src/categoryController.js

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
 * Get all support persons (for admin purposes) - FIXED: Returns distinct names only
 */
export const getAllSupportPersons = async (req, res) => {
  try {
    const pool = getDB();
    const request = pool.request();
    
    // First get all support persons with their categories
    const result = await request.query(`
      SELECT 
        sp.id, sp.name, sp.email, sp.is_active, sp.created_at,
        c.name as category_name
      FROM SupportPersons sp
      INNER JOIN Categories c ON sp.category_id = c.id
      WHERE sp.is_active = 1
      ORDER BY sp.name, c.name
    `);
    
    // Process the results to group by name and combine categories
    const supportPersonsMap = new Map();
    
    result.recordset.forEach(person => {
      const key = `${person.name}_${person.email}`;
      
      if (supportPersonsMap.has(key)) {
        // Add category to existing person
        const existing = supportPersonsMap.get(key);
        existing.category_names = existing.category_names + ', ' + person.category_name;
      } else {
        // Add new person
        supportPersonsMap.set(key, {
          id: person.id,
          name: person.name,
          email: person.email,
          is_active: person.is_active,
          created_at: person.created_at,
          category_names: person.category_name
        });
      }
    });
    
    // Convert map to array and sort by name
    const uniqueSupportPersons = Array.from(supportPersonsMap.values())
      .sort((a, b) => a.name.localeCompare(b.name));
    
    return sendResponse(res, 200, true, 'All support persons retrieved successfully', uniqueSupportPersons);
    
  } catch (error) {
    console.error('❌ Get all support persons error:', error);
    return sendError(res, 500, 'Failed to retrieve support persons');
  }
};