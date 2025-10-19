var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const connectDB = require('./src/config/db');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./src/config/swagger');
require('dotenv').config();

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var authRouter = require('./src/routes/auth');
var userRouter = require('./src/routes/user');
var videoRouter = require('./src/routes/video');
const mongoose = require('mongoose');

var app = express();
connectDB();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Enable CORS for all routes without relying on the external cors package
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
});

// Swagger Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/api/auth', authRouter);
app.use('/api/user', userRouter);
app.use('/api/videos', videoRouter);

// Health check endpoint for Docker / orchestrator
app.get('/health', async (req, res) => {
	const uptime = process.uptime();
	const env = process.env.NODE_ENV || 'development';

	// mongoose connection states: 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
	const dbState = mongoose && mongoose.connection ? mongoose.connection.readyState : 0;
	const dbStatus = dbState === 1 ? 'ok' : dbState === 2 ? 'connecting' : 'down';

	const payload = {
		status: 'ok',
		env,
		uptime_seconds: Math.floor(uptime),
		db: dbStatus,
		timestamp: new Date().toISOString(),
	};

	// return 200 when DB is ok or when no MONGO_URI was configured (CI-mode)
	const healthy = dbState === 1 || !process.env.MONGO_URI;
	return res.status(healthy ? 200 : 503).json(payload);
});

module.exports = app;


