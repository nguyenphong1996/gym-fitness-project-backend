var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const connectDB = require('./src/config/db');
require('dotenv').config();

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var otpRouter = require('./src/routes/otp');
var authRouter = require('./src/routes/auth');
var userRouter = require('./src/routes/user');

var app = express();
connectDB();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/otp', otpRouter);
app.use('/api/auth', authRouter);
app.use('/api/user', userRouter);

module.exports = app;


