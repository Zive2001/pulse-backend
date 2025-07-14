import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

// Import routes
import authRoutes from './routes/auth.js';
import categoryRoutes from './routes/categories.js';
import ticketRoutes from './routes/tickets.js';

// Import utilities
import { sendError } from './utils/helpers.js';

// Load environment variables
dotenv.config();

const app = express();

// Security middleware
app.use(helmet());

// More flexible rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 300, // Increased from 100 to 300
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
    timestamp: new Date().toISOString()
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting for health checks
  skip: (req) => req.path === '/api/health',
  // Use a combination of IP and user agent for better identification
  keyGenerator: (req) => {
    return req.ip + ':' + (req.get('User-Agent') || '').substring(0, 50);
  }
});

// Apply rate limiting to all requests except health check
app.use(limiter);

// Simplified CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'https://sg-prod-bdyapp-pulsefrontend-g9aqfserb6bea8eq.southeastasia-01.azurewebsites.net',
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:5174'
    ];
    
    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log('❌ CORS blocked origin:', origin);
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
  exposedHeaders: ['Content-Length', 'X-Foo', 'X-Bar']
};

app.use(cors(corsOptions));

// Explicit preflight handling - This is important for complex CORS scenarios
app.options('*', (req, res) => {
  const origin = req.headers.origin;
  const allowedOrigins = [
    'https://sg-prod-bdyapp-pulsefrontend-g9aqfserb6bea8eq.southeastasia-01.azurewebsites.net',
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:5174'
  ];
  
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS,PATCH');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Access-Control-Request-Method, Access-Control-Request-Headers');
  }
  
  res.sendStatus(200);
});

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware - Enhanced for better debugging
app.use((req, res, next) => {
  console.log(`🔍 ${new Date().toISOString()} - ${req.method} ${req.path}`);
  console.log(`📍 Origin: ${req.headers.origin || 'No origin'}`);
  console.log(`🔑 Auth: ${req.headers.authorization ? 'Present' : 'Not present'}`);
  console.log(`📦 Content-Type: ${req.headers['content-type'] || 'Not set'}`);
  console.log(`🌐 IP: ${req.ip}`);
  console.log(`📱 User-Agent: ${req.get('User-Agent') || 'Not set'}`);
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
      allowedOrigins: [
        'https://sg-prod-bdyapp-pulsefrontend-g9aqfserb6bea8eq.southeastasia-01.azurewebsites.net',
        'http://localhost:3000',
        'http://localhost:5173',
        'http://localhost:5174'
      ]
    },
    rateLimit: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
      max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 300
    }
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/tickets', ticketRoutes);

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