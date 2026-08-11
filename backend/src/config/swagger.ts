import swaggerJsdoc from 'swagger-jsdoc';
import path from 'path';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Solomon Bharat API',
      version: '1.0.0',
      description:
        'B2B wholesale export marketplace API. Admin-intermediated trade flow — sellers and buyers never interact directly.',
    },
    servers: [{ url: '/api/v1' }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        ApiResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object', nullable: true },
            message: { type: 'string' },
            meta: { type: 'object', nullable: true },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  // swagger-jsdoc resolves `apis` patterns via the `glob` package, which requires forward
  // slashes even on Windows — path.join() alone would emit backslashes here and silently
  // match zero files.
  apis: [
    path.join(__dirname, '../modules/**/*.routes.ts').replace(/\\/g, '/'),
    path.join(__dirname, '../modules/**/*.routes.js').replace(/\\/g, '/'),
  ],
};

export const swaggerSpec = swaggerJsdoc(options);
