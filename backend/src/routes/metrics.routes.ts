import express from 'express';
import client from 'prom-client';
import logger from '../utils/logger';

const router = express.Router();

router.get('/metrics', async (_req, res) => {
    try {
        res.set('Content-Type', client.register.contentType);
        const metrics = await client.register.metrics();
        res.send(metrics);
    } catch (error) {
        logger.error('Error generating metrics', { error });
        res.status(500).send('Error generating metrics');
    }
});

export default router;