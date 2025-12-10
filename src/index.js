require('dotenv').config();
const express = require('express');
const { MongoClient, ServerApiVersion } = require('mongodb');
const apiRouter = express.Router();

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const staffRoutes = require('./routes/staff');
const adminUserRoutes = require('./routes/adminUser');
const classRoutes = require('./routes/class');
const enrollmentRoutes = require('./routes/enrollment');
const customerVideoRoutes = require('./routes/customerVideoFavorites');
const videoRoutes = require('./routes/video');
const staffClassAttendanceRoutes = require('./routes/staffClassAttendance');
const paymentRoutes = require('./routes/payment'); // Import payment routes
const packageRoutes = require('./routes/packages');

// Swagger documentation
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');

// API documentation endpoint
apiRouter.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Register routes
apiRouter.use('/auth', authRoutes);
apiRouter.use('/user', userRoutes);
apiRouter.use('/admin/staff', staffRoutes);
apiRouter.use('/admin/users', adminUserRoutes);
apiRouter.use('/admin/classes', classRoutes);
apiRouter.use('/staff/classes', staffClassAttendanceRoutes);
apiRouter.use('/customer/videos', customerVideoRoutes);
apiRouter.use('/customer', enrollmentRoutes);
apiRouter.use('/videos', videoRoutes);
apiRouter.use('/payment', paymentRoutes); // Register payment routes
apiRouter.use('/packages', packageRoutes);

// Health check
apiRouter.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'Gym Fitness API'
  });
});


const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const uri = process.env.MONGO_URI;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");

    app.use('/api', apiRouter);

    app.listen(port, () => {
      console.log(`Server is running on http://localhost:${port}`);
    });

  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
