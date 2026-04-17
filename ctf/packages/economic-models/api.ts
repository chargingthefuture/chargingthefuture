import { FastifyInstance } from 'fastify';
import { extractAnonymizedTransactions, extractAnonymizedRegionalFlows, extractAnonymizedInputOutput } from './etl';
import { RawTransactionRecord, RawRegionalFlowRecord, RawInputOutputRecord } from './types';
import { computeNetworkInterdependence } from './module-network';
import { computeGeopoliticalInterdependence } from './module-geopolitical';
import { computeInputOutputInterdependence } from './module-inputoutput';

// --- API Routes ---
export async function economicModelsRoutes(app: FastifyInstance) {
  // POST /api/economic-models/network/scores
  app.post('/api/economic-models/network/scores', {
    schema: {
      body: {
        type: 'object',
        required: ['rawRecords'],
        properties: {
          rawRecords: {
            type: 'array',
            items: {
              type: 'object',
              required: ['id', 'timestamp', 'from', 'to', 'amount', 'currency'],
              properties: {
                id: { type: 'string' },
                timestamp: { type: 'string' },
                from: { type: 'string' },
                to: { type: 'string' },
                amount: { type: 'number' },
                currency: { type: 'string' },
                description: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, async (req, reply) => {
    const { rawRecords } = req.body as { rawRecords: RawTransactionRecord[] };
    const transactions = extractAnonymizedTransactions(rawRecords);
    const result = computeNetworkInterdependence(transactions);
    reply.send(result);
  });

  // POST /api/economic-models/geopolitical/scores
  app.post('/api/economic-models/geopolitical/scores', {
    schema: {
      body: {
        type: 'object',
        required: ['rawRecords'],
        properties: {
          rawRecords: {
            type: 'array',
            items: {
              type: 'object',
              required: ['id', 'region', 'inflow', 'outflow', 'net', 'period'],
              properties: {
                id: { type: 'string' },
                region: { type: 'string' },
                inflow: { type: 'number' },
                outflow: { type: 'number' },
                net: { type: 'number' },
                period: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, async (req, reply) => {
    const { rawRecords } = req.body as { rawRecords: RawRegionalFlowRecord[] };
    const flows = extractAnonymizedRegionalFlows(rawRecords);
    const result = computeGeopoliticalInterdependence(flows);
    reply.send(result);
  });

  // POST /api/economic-models/input-output/scores
  app.post('/api/economic-models/input-output/scores', {
    schema: {
      body: {
        type: 'object',
        required: ['rawRecords'],
        properties: {
          rawRecords: {
            type: 'array',
            items: {
              type: 'object',
              required: ['id', 'sector', 'input', 'output', 'period'],
              properties: {
                id: { type: 'string' },
                sector: { type: 'string' },
                input: { type: 'number' },
                output: { type: 'number' },
                period: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, async (req, reply) => {
    const { rawRecords } = req.body as { rawRecords: RawInputOutputRecord[] };
    const ioRecords = extractAnonymizedInputOutput(rawRecords);
    const result = computeInputOutputInterdependence(ioRecords);
    reply.send(result);
  });
}
