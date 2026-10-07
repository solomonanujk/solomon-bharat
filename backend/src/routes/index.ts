import { Router } from 'express';
import { authRouter } from '../modules/auth/auth.routes';
import { categoriesRouter } from '../modules/categories/categories.routes';
import { sellersRouter } from '../modules/sellers/sellers.routes';
import { productsRouter } from '../modules/products/products.routes';
import { collectionsRouter } from '../modules/collections/collections.routes';
import { buyersRouter } from '../modules/buyers/buyers.routes';
import { ordersRouter } from '../modules/orders/orders.routes';
import { paymentsRouter } from '../modules/payments/payments.routes';
import { payoutsRouter } from '../modules/payouts/payouts.routes';
import { notificationsRouter } from '../modules/notifications/notifications.routes';
import { adminRouter } from '../modules/admin/admin.routes';
import { reviewsRouter } from '../modules/reviews/reviews.routes';
import { agentApplicationsRouter } from '../modules/agent-applications/agent-applications.routes';
import { cataloguesRouter } from '../modules/catalogues/catalogues.routes';

export const apiRouter = Router();

/**
 * @openapi
 * /health:
 *   get:
 *     summary: Health check
 *     tags: [System]
 *     security: []
 *     responses:
 *       200:
 *         description: Service is healthy
 */
apiRouter.get('/health', (_req, res) => {
  res.status(200).json({ success: true, data: { status: 'ok' }, message: 'Healthy' });
});

apiRouter.use('/auth', authRouter);
apiRouter.use('/categories', categoriesRouter);
apiRouter.use('/sellers', sellersRouter);
apiRouter.use('/products', productsRouter);
apiRouter.use('/collections', collectionsRouter);
apiRouter.use('/buyers', buyersRouter);
apiRouter.use('/orders', ordersRouter);
apiRouter.use('/payments', paymentsRouter);
apiRouter.use('/payouts', payoutsRouter);
apiRouter.use('/notifications', notificationsRouter);
apiRouter.use('/admin', adminRouter);
apiRouter.use('/reviews', reviewsRouter);
apiRouter.use('/agents', agentApplicationsRouter);
apiRouter.use('/agent/catalogues', cataloguesRouter);
