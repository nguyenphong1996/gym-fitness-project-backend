const path = require('path');
const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Gym Fitness API',
      version: '1.0.0',
      description: 'Trang hướng dẫn setup API cho dự án Gym Fitness'
    },
    servers: [
      {
        url: 'https://be.vnchack.com',
        description: 'Production server'
      },
      {
        url: 'http://localhost:3000',
        description: 'Local server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter JWT token'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            message: {
              type: 'string',
              example: 'Error message'
            }
          }
        },
        User: {
          type: 'object',
          required: ['_id', 'phone', 'email', 'isVerified'],
          properties: {
            _id: {
              type: 'string',
              example: '507f1f77bcf86cd799439011'
            },
            phone: {
              type: 'string',
              example: '0912345678'
            },
            name: {
              type: 'string',
              example: 'Nguyen Van A'
            },
            email: {
              type: 'string',
              example: 'user@example.com'
            },
            isVerified: {
              type: 'boolean',
              example: true
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time'
            },
            membership: {
              type: 'object',
              properties: {
                packageId: { type: 'string' },
                startDate: { type: 'string', format: 'date-time' },
                endDate: { type: 'string', format: 'date-time' },
                remainingSessions: { type: 'number' },
                status: { type: 'string', enum: ['active', 'expired', 'none'] },
                lastRenewalDate: { type: 'string', format: 'date-time' }
              }
            }
          }
        },
        AdminUserInfo: {
          type: 'object',
          required: ['id', 'phone', 'role', 'isVerified'],
          properties: {
            id: {
              type: 'string',
              example: '64f0c1c2a1b2c3d4e5f60789'
            },
            phone: {
              type: 'string',
              example: '0912345678'
            },
            name: {
              type: 'string',
              nullable: true,
              example: 'Nguyen Van A'
            },
            email: {
              type: 'string',
              nullable: true,
              example: 'user@example.com'
            },
            role: {
              type: 'string',
              enum: ['admin', 'staff', 'customer'],
              example: 'customer'
            },
            isVerified: {
              type: 'boolean',
              example: true
            },
            isActive: {
              type: 'boolean',
              nullable: true,
              example: true
            },
            avatar: {
              type: 'string',
              nullable: true,
              example: 'https://res.cloudinary.com/demo/image/upload/sample.jpg'
            },
            gender: {
              type: 'string',
              nullable: true,
              enum: ['male', 'female', 'other'],
              example: 'male'
            },
            dob: {
              type: 'string',
              format: 'date',
              nullable: true,
              example: '1990-01-01'
            },
            weight: {
              type: 'number',
              format: 'float',
              nullable: true,
              example: 70
            },
            height: {
              type: 'number',
              format: 'float',
              nullable: true,
              example: 175
            },
            skills: {
              type: 'array',
              items: {
                type: 'string'
              },
              example: ['yoga', 'cardio']
            },
            hireDate: {
              type: 'string',
              format: 'date',
              nullable: true,
              example: '2024-01-15'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time'
            },
            membership: {
              type: 'object',
              properties: {
                packageId: { type: 'string' },
                startDate: { type: 'string', format: 'date-time' },
                endDate: { type: 'string', format: 'date-time' },
                remainingSessions: { type: 'number' },
                status: { type: 'string', enum: ['active', 'expired', 'none'] },
                lastRenewalDate: { type: 'string', format: 'date-time' }
              }
            }
          }
        }
      }
    },
    security: []
  },
  apis: [
    path.resolve(__dirname, '../routes/*.js'),
    path.resolve(__dirname, '../controllers/*.js')
  ]
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
