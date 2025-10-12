var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var cors = require('cors');
const connectDB = require('./src/config/db');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./src/config/swagger');
require('dotenv').config();

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var otpRouter = require('./src/routes/otp');
var authRouter = require('./src/routes/auth');
var userRouter = require('./src/routes/user');

var app = express();
connectDB();

// CORS configuration for frontend access
app.use(cors({
  origin: process.env.FRONTEND_URL || '*', // Allow specific frontend domain or all domains
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Swagger Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Gym Fitness API Docs'
}));

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/otp', otpRouter);
app.use('/api/auth', authRouter);
app.use('/api/user', userRouter);

module.exports = app;


