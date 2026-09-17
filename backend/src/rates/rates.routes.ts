import { FastifyInstance } from 'fastify';
import { RatesService } from './rates.service.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function ratesRoutes(fastify: FastifyInstance) {
  fastify.post('/api/rates/import', {
    config: {
      rawBody: true // Requires raw body access for CSV
    }
  }, async (request, reply) => {
    let csvData = '';
    
    // Check if it's text/csv or a json with a csv field
    if (request.headers['content-type']?.includes('text/csv')) {
      csvData = request.body as string; // Fastify plain-text/raw-body plugin needs to be configured
    } else if (typeof request.body === 'object' && request.body !== null && 'csv' in request.body) {
      csvData = (request.body as any).csv;
    } else {
      return reply.status(400).send({ error: 'Bad Request', message: 'Content-Type text/csv or JSON with { csv: string } required' });
    }

    if (!csvData || csvData.trim() === '') {
      return reply.status(400).send({ error: 'Bad Request', message: 'Empty CSV payload' });
    }

    try {
      const report = await RatesService.importCSV(csvData);
      return reply.status(200).send(report);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  fastify.get('/api/rates', async (request, reply) => {
    // Get latest rate card per spot type
    const types = ['COMPACT', 'STANDARD', 'EV'];
    const rates = [];

    for (const type of types) {
      const rate = await prisma.rateCard.findFirst({
        where: { spotType: type as any },
        orderBy: { effectiveFrom: 'desc' }
      });
      if (rate) rates.push(rate);
    }

    return reply.status(200).send(rates);
  });
}
