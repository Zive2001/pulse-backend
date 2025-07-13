import app from './src/app.js';
import { connectDB } from './src/config/database.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 3000;

// Start server
const startServer = async () => {
  try {
    // Connect to database
    await connectDB();
    
    // Start Express server
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🌐 Health check: http://localhost:${PORT}/api/health`);
      
      if (process.env.NODE_ENV === 'development') {
        console.log('\n📝 Available endpoints:');
        console.log(`   POST   /api/auth/login`);
        console.log(`   GET    /api/auth/profile`);
        console.log(`   GET    /api/categories`);
        console.log(`   GET    /api/categories/:id/support-persons`);
        console.log(`   POST   /api/tickets`);
        console.log(`   GET    /api/tickets`);
        console.log(`   GET    /api/tickets/all`);
        console.log(`   GET    /api/tickets/:id`);
        console.log(`   PUT    /api/tickets/:id/status`);
        console.log(`   PUT    /api/tickets/:id/remark`);
        console.log(`   PUT    /api/tickets/:id/approve`);
        console.log(`   GET    /api/tickets/:id/history`);
        console.log('\n');
      }
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully...');
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
startServer();