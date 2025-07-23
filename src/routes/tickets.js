import express from 'express';
import { 
  createTicket, 
  getUserTickets, 
  getAllTickets, 
  getTicketById,
  updateTicketStatus, 
  addTicketRemark,
  approveTicket,
  rejectTicket,
  getTicketHistory 
} from '../controllers/ticketController.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import { 
  validateCreateTicket, 
  validateUpdateTicketStatus, 
  validateTicketId,
  validateTicketRemark
} from '../middleware/validation.js';

const router = express.Router();

/**
 * @route   POST /api/tickets
 * @desc    Create a new ticket
 * @access  Private
 */
router.post('/', authenticateToken, validateCreateTicket, createTicket);

/**
 * @route   GET /api/tickets
 * @desc    Get tickets for logged-in user
 * @access  Private
 */
router.get('/', authenticateToken, getUserTickets);

/**
 * @route   GET /api/tickets/all
 * @desc    Get all tickets (for managers, digital team, and admin)
 * @access  Private (Manager, Digital Team, Admin)
 */
router.get('/all', authenticateToken, authorizeRoles('manager', 'digital_team', 'admin'), getAllTickets);

/**
 * @route   GET /api/tickets/:id
 * @desc    Get single ticket by ID
 * @access  Private
 */
router.get('/:id', authenticateToken, validateTicketId, getTicketById);

/**
 * @route   PUT /api/tickets/:id/status
 * @desc    Update ticket status
 * @access  Private (Manager, Digital Team, Admin)
 */
router.put('/:id/status', 
  authenticateToken, 
  authorizeRoles('manager', 'digital_team', 'admin'), 
  validateUpdateTicketStatus, 
  updateTicketStatus
);

/**
 * @route   PUT /api/tickets/:id/remark
 * @desc    Add remark to ticket
 * @access  Private (Manager, Digital Team, Admin)
 */
router.put('/:id/remark', 
  authenticateToken, 
  authorizeRoles('manager', 'digital_team', 'admin'), 
  validateTicketId,
  validateTicketRemark,
  addTicketRemark
);

/**
 * @route   PUT /api/tickets/:id/approve
 * @desc    Approve ticket (for managers only)
 * @access  Private (Manager only)
 */
router.put('/:id/approve', 
  authenticateToken, 
  authorizeRoles('manager'), 
  validateTicketId, 
  approveTicket
);

/**
 * @route   GET /api/tickets/:id/history
 * @desc    Get ticket history
 * @access  Private (Manager, Digital Team, Admin, Ticket Creator)
 */
router.get('/:id/history', 
  authenticateToken, 
  validateTicketId, 
  getTicketHistory
);

export default router;