import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import mongoose from 'mongoose';
import cacheService from './services/cache.service';

// Routes
import detectRouter from './routes/detect-simple';
import historyRouter from './routes/history.routes';
import bulkRouter from './routes/bulk.routes';

const app = express();
const port = process.env.PORT || 5000;

// Connect to MongoDB
const connectMongoDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/vpn_detector';
    await mongoose.connect(mongoUri);
    console.log('✓ MongoDB connected successfully');
  } catch (error) {
    console.log('⚠ Starting without MongoDB:', error instanceof Error ? error.message : 'Unknown error');
  }
};

// Connect to Redis (optional - continues without it if fails)
cacheService.connect().catch(err => {
  console.log('Starting without Redis cache');
});

// Connect to MongoDB
connectMongoDB();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// CORS configuration
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
app.use(morgan('dev'));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    redis: 'available',
  });
});

// API Routes
app.use('/api/detect', detectRouter);
app.use('/api/history', historyRouter);
app.use('/api/bulk', bulkRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message 
  });
});

// Start server
app.listen(port, () => {
  console.log(`
  ═══════════════════════════════════════════════
  🚀 VPN Detector Server Running!
  ═══════════════════════════════════════════════
  📡 Port: ${port}
  🌍 Environment: ${process.env.NODE_ENV || 'development'}
  🔗 Frontend URL: http://localhost:5173
  ⏰ Timestamp: ${new Date().toISOString()}
  ═══════════════════════════════════════════════
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  process.exit(0);
});
