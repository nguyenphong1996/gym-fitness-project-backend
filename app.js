var express = require('express');
var path = require('path');
var fs = require('fs');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const createCorsMiddleware = require('./src/middlewares/cors');
const connectDB = require('./src/config/db');
require('dotenv').config();

const swaggerUiPath = path.join(__dirname, 'node_modules', 'swagger-ui-express');
const swaggerJsdocPath = path.join(__dirname, 'node_modules', 'swagger-jsdoc');
const hasSwaggerUi = fs.existsSync(swaggerUiPath);
const hasSwaggerJsdoc = fs.existsSync(swaggerJsdocPath);
const swaggerUi = hasSwaggerUi ? require('swagger-ui-express') : null;
const swaggerSpec = hasSwaggerUi && hasSwaggerJsdoc ? require('./src/config/swagger') : null;

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var authRouter = require('./src/routes/auth');
var userRouter = require('./src/routes/user');
var videoRouter = require('./src/routes/video');
var staffRouter = require('./src/routes/staff');
var staffAuthRouter = require('./src/routes/staffAuth');
var staffProfileRouter = require('./src/routes/staffProfile');
var staffAvailabilityRouter = require('./src/routes/staffAvailability');
var customerPtBookingRouter = require('./src/routes/customerPtBooking');
var adminUserRouter = require('./src/routes/adminUser');
var classRouter = require('./src/routes/class');
var enrollmentRouter = require('./src/routes/enrollment');
var customerVideoFavoritesRouter = require('./src/routes/customerVideoFavorites');
var staffClassAttendanceRouter = require('./src/routes/staffClassAttendance');
var paymentRouter = require('./src/routes/payment'); // Added for VNPAY
var packageRouter = require('./src/routes/package'); // Added for Membership Packages

const mongoose = require('mongoose');
const {
  evaluateClassesForBackground,
} = require('./src/services/classStatusService');

const DIAGNOSTIC_TOKEN = process.env.DIAGNOSTIC_TOKEN || null;
let isDbReady = mongoose.connection.readyState === 1;
let lastDbError = null;

const markDbReady = () => {
  isDbReady = true;
  lastDbError = null;
};

const markDbNotReady = (err) => {
  isDbReady = false;
  if (err) {
    lastDbError = err;
  }
};

mongoose.connection.on('connected', markDbReady);
mongoose.connection.on('reconnected', markDbReady);
mongoose.connection.on('disconnected', () => markDbNotReady());
mongoose.connection.on('error', markDbNotReady);

const pingDatabase = async (timeoutMs = 2000) => {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('Mongoose is not connected');
  }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Database ping timed out'));
    }, timeoutMs);

    mongoose.connection.db.admin().command({ ping: 1 })
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
};

const requireDiagnosticAuth = (req, res, next) => {
  if (!DIAGNOSTIC_TOKEN) {
    return res.status(403).json({ message: 'Diagnostic access not configured' });
  }

  const providedToken = req.headers['x-diagnostic-token'];
  if (!providedToken || providedToken !== DIAGNOSTIC_TOKEN) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  next();
};

var app = express();
connectDB();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Enable CORS for all routes without relying on the external "cors" package
app.use(createCorsMiddleware({
  origin: process.env.CORS_ORIGIN || '*',
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  allowedHeaders: 'Content-Type, Authorization'
}));

// Swagger Documentation (skip if dependencies are not available)
if (swaggerUi && swaggerSpec) {
  // Serve JSON spec at /api-docs/swagger.json
  app.get('/api-docs/swagger.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  // Serve Swagger UI at /api-docs
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customCss: '.swagger-ui .topbar .download-url-wrapper { display: none }',
    customSiteTitle: 'Gym Fitness API Documentation'
  }));
} else if (!hasSwaggerUi || !hasSwaggerJsdoc) {
  console.warn('⚠️  Swagger dependencies missing - skipping /api-docs route');
}

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/api/auth', authRouter);
app.use('/api/staff/auth', staffAuthRouter);
app.use('/api/staff', staffProfileRouter);
app.use('/api/staff', staffAvailabilityRouter);
app.use('/api/staff/classes', staffClassAttendanceRouter);
app.use('/api/user', userRouter);
app.use('/api/videos', videoRouter);
app.use('/api/admin/staff', staffRouter);
app.use('/api/admin/users', adminUserRouter);
app.use('/api/admin/classes', classRouter);
app.use('/api/customer/videos', customerVideoFavoritesRouter);
app.use('/api/customer/pt', customerPtBookingRouter);
app.use('/api/customer', enrollmentRouter);
app.use('/api/v1/payment', paymentRouter); // Added for VNPAY
app.use('/api/admin/packages', packageRouter); // Added for Membership Packages


/**
 * Background scheduler: evaluate class lifecycle to keep statuses up to date.
 * Enabled by default. Set ENABLE_CLASS_STATUS_CRON=false to disable.
 * Customize interval via CLASS_STATUS_CRON_INTERVAL_MS (default 60s).
 */
const ENABLE_CLASS_STATUS_CRON = String(process.env.ENABLE_CLASS_STATUS_CRON || 'true').toLowerCase() !== 'false';
const CLASS_STATUS_CRON_INTERVAL_MS = (() => {
  const parsed = parseInt(process.env.CLASS_STATUS_CRON_INTERVAL_MS, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 60_000;
})();

if (ENABLE_CLASS_STATUS_CRON) {
  let statusEvaluationInterval = null;
  let isEvaluationRunning = false;

  const stopStatusEvaluation = () => {
    if (statusEvaluationInterval) {
      clearInterval(statusEvaluationInterval);
      statusEvaluationInterval = null;
    }
  };

  const runStatusEvaluation = async () => {
    if (isEvaluationRunning || mongoose.connection.readyState !== 1) {
      return;
    }
    isEvaluationRunning = true;
    try {
      await evaluateClassesForBackground();
    } catch (error) {
      console.error('⚠️  Failed to evaluate class statuses:', error);
    } finally {
      isEvaluationRunning = false;
    }
  };

  const startStatusEvaluation = () => {
    if (statusEvaluationInterval) {
      return;
    }
    statusEvaluationInterval = setInterval(runStatusEvaluation, CLASS_STATUS_CRON_INTERVAL_MS);
    runStatusEvaluation().catch(() => {
      // Error already logged inside runStatusEvaluation
    });
  };

  if (mongoose.connection.readyState === 1) {
    startStatusEvaluation();
  } else {
    mongoose.connection.once('connected', startStatusEvaluation);
  }

  mongoose.connection.on('disconnected', stopStatusEvaluation);
}

// Lightweight liveness probe
/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Liveness probe
 *     description: Kiểm tra nhanh xem service còn chạy hay không. Không kiểm tra kết nối cơ sở dữ liệu.
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Service đang hoạt động
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 */
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Readiness probe with database verification
/**
 * @swagger
 * /api/ready:
 *   get:
 *     summary: Readiness probe
 *     description: Kiểm tra trạng thái kết nối tới MongoDB và các cấu hình bắt buộc. Trả về 200 khi service sẵn sàng nhận traffic.
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Service sẵn sàng
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ready
 *       503:
 *         description: Service chưa sẵn sàng (ví dụ chưa kết nối được MongoDB)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: not_ready
 */
app.get('/ready', async (req, res) => {
  if (!process.env.MONGO_URI) {
    return res.status(503).json({ status: 'not_ready' });
  }

  try {
    if (!isDbReady) {
      throw new Error('Database connection not ready');
    }

    await pingDatabase(2000);
    return res.status(200).json({ status: 'ready' });
  } catch (error) {
    markDbNotReady(error);
    return res.status(503).json({ status: 'not_ready' });
  }
});

// Authenticated diagnostic endpoint
/**
 * @swagger
 * /api/diagnostic:
 *   get:
 *     summary: Diagnostic endpoint (yêu cầu token nội bộ)
 *     description: Cung cấp thông tin chẩn đoán nội bộ bao gồm trạng thái DB, uptime. Yêu cầu gửi header `x-diagnostic-token`.
 *     tags: [System]
 *     parameters:
 *       - in: header
 *         name: x-diagnostic-token
 *         required: true
 *         schema:
 *           type: string
 *         description: Token nội bộ để truy cập diagnostic endpoint.
 *     responses:
 *       200:
 *         description: Trả về thông tin chẩn đoán
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: "ready" }
 *                 env: { type: string, example: "production" }
 *                 uptime_seconds: { type: number, example: 123 }
 *                 db:
 *                   type: object
 *                   properties:
 *                     readyState: { type: integer, example: 1 }
 *                     host: { type: string, nullable: true }
 *                     name: { type: string, nullable: true }
 *                     lastError: { type: string, nullable: true }
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Thiếu hoặc sai diagnostic token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Unauthorized
 *       403:
 *         description: Diagnostic token chưa được cấu hình
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Diagnostic access not configured
 */
app.get('/diagnostic', requireDiagnosticAuth, (req, res) => {
  const dbState = mongoose.connection?.readyState ?? 0;
  const uptimeSeconds = Math.floor(process.uptime());

  res.json({
    status: isDbReady ? 'ready' : 'not_ready',
    env: process.env.NODE_ENV || 'development',
    uptime_seconds: uptimeSeconds,
    db: {
      readyState: dbState,
      host: mongoose.connection?.host || null,
      name: mongoose.connection?.name || null,
      lastError: lastDbError ? lastDbError.message : null
    },
    timestamp: new Date().toISOString()
  });
});

module.exports = app;
