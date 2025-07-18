import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

// Import routes
import authRoutes from './routes/auth.js';
import categoryRoutes from './routes/categories.js';
import ticketRoutes from './routes/tickets.js';
import adminRoutes from './routes/admin.js';
import dataRoutes from './routes/data.js';
import emailRoutes from './routes/emailRoutes.js'; // Added email routes

// Import utilities
import { sendError } from './utils/helpers.js';

// Load environment variables
dotenv.config();

const app = express();

// Security middleware - Configure helmet to allow CORS
app.use(helmet({
  crossOriginResourcePolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// Define allowed origins
const allowedOrigins = [
  'https://sg-prod-bdyapp-pulsefrontend-g9aqfserb6bea8eq.southeastasia-01.azurewebsites.net',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5174'
];

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 500,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
    timestamp: new Date().toISOString()
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/api/health',
  keyGenerator: (req) => {
    return req.ip + ':' + (req.get('User-Agent') || '').substring(0, 50);
  }
});

app.use(limiter);

// CORS configuration - Simplified and more reliable
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) {
      console.log('✅ No origin - allowing request');
      return callback(null, true);
    }
    
    console.log('🔍 Checking origin:', origin);
    
    if (allowedOrigins.includes(origin)) {
      console.log('✅ Origin allowed:', origin);
      callback(null, true);
    } else {
      console.log('❌ Origin blocked:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With',
    'Accept',
    'Origin',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers'
  ],
  exposedHeaders: ['Content-Length', 'Authorization'],
  preflightContinue: false
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Additional manual CORS headers for extra reliability
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  // Set CORS headers if origin is allowed
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS,PATCH');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Access-Control-Request-Method, Access-Control-Request-Headers');
  }
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    console.log('🚀 Preflight request for:', req.path);
    console.log('🔍 Origin:', origin);
    console.log('🔑 Headers sent:', {
      'Access-Control-Allow-Origin': res.getHeader('Access-Control-Allow-Origin'),
      'Access-Control-Allow-Methods': res.getHeader('Access-Control-Allow-Methods'),
      'Access-Control-Allow-Headers': res.getHeader('Access-Control-Allow-Headers'),
      'Access-Control-Allow-Credentials': res.getHeader('Access-Control-Allow-Credentials')
    });
    return res.status(200).end();
  }
  
  next();
});

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Enhanced request logging
app.use((req, res, next) => {
  console.log(`\n🔍 ${new Date().toISOString()} - ${req.method} ${req.path}`);
  console.log(`📍 Origin: ${req.headers.origin || 'No origin'}`);
  console.log(`🔑 Auth: ${req.headers.authorization ? 'Present' : 'Not present'}`);
  console.log(`📦 Content-Type: ${req.headers['content-type'] || 'Not set'}`);
  console.log(`🌐 IP: ${req.ip}`);
  console.log(`📱 User-Agent: ${(req.get('User-Agent') || 'Not set').substring(0, 100)}...`);
  
  // Log response headers for debugging
  const originalSend = res.send;
  res.send = function(data) {
    console.log(`📤 Response Headers:`, {
      'Access-Control-Allow-Origin': res.getHeader('Access-Control-Allow-Origin'),
      'Access-Control-Allow-Credentials': res.getHeader('Access-Control-Allow-Credentials')
    });
    return originalSend.call(this, data);
  };
  
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    cors: {
      allowedOrigins: allowedOrigins
    },
    rateLimit: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
      max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 500
    }
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', dataRoutes);
app.use('/api/email', emailRoutes); // Added email routes

// Handle 404 - Route not found
app.use('*', (req, res) => {
  console.log(`❌ 404 - Route not found: ${req.originalUrl}`);
  sendError(res, 404, `Route ${req.originalUrl} not found`);
});

// Global error handling middleware
app.use((error, req, res, next) => {
  console.error('❌ Unhandled error:', error);
  
  // Handle CORS errors specifically
  if (error.message === 'Not allowed by CORS') {
    console.log('❌ CORS Error for origin:', req.headers.origin);
    return sendError(res, 403, 'CORS policy violation');
  }
  
  // Handle specific error types
  if (error.name === 'ValidationError') {
    return sendError(res, 400, 'Validation error', error.message);
  }
  
  if (error.name === 'CastError') {
    return sendError(res, 400, 'Invalid ID format');
  }
  
  if (error.code === 11000) {
    return sendError(res, 409, 'Duplicate field value');
  }
  
  // Default error
  const statusCode = error.statusCode || 500;
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : error.message;
    
  sendError(res, statusCode, message);
});

export default app;