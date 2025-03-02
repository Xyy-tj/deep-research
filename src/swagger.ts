import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';

// OpenAPI specification options
const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Deep Research API',
      version: '1.0.0',
      description: 'API documentation for the Deep Research application',
      contact: {
        name: 'Support',
        email: 'support@example.com'
      },
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'auth_token',
        },
      },
    },
    security: [
      { bearerAuth: [] },
      { cookieAuth: [] },
    ],
  },
  apis: [
    './src/user/auth-routes-docs.ts',
    './src/research-api-docs.ts',
    './src/user/user-api-docs.ts'
  ], // Path to the API docs
};

// Initialize swagger-jsdoc
const openapiSpecification = swaggerJsdoc(options);

// Function to setup Swagger UI
export const setupSwagger = (app: Express) => {
  // Serve swagger docs
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapiSpecification, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
  }));

  // Serve OpenAPI spec as JSON
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(openapiSpecification);
  });
};
