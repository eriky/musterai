// File: src/realtime/sse.ts
import { Response } from 'express';
import { Event } from '../shared/types.js';

interface Client {
  id: string;
  projectId: string;
  res: Response;
}

export class SSEManager {
  private clients: Client[] = [];
  private pingInterval: NodeJS.Timeout;

  constructor() {
    // Send keep-alive comment every 10s to keep connections alive through proxies
    this.pingInterval = setInterval(() => {
      for (const client of this.clients) {
        try {
          client.res.write(': keep-alive\n\n');
        } catch {
          // Ignore write errors
        }
      }
    }, 10000);
  }

  addClient(projectId: string, clientId: string, res: Response): void {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const client: Client = { id: clientId, projectId, res };
    this.clients.push(client);

    res.on('close', () => {
      this.removeClient(clientId);
    });
  }

  removeClient(clientId: string): void {
    this.clients = this.clients.filter(c => c.id !== clientId);
  }

  broadcast(projectId: string, event: Event): void {
    const targetClients = this.clients.filter(c => c.projectId === projectId);
    const data = `data: ${JSON.stringify(event)}\n\n`;

    for (const client of targetClients) {
      try {
        client.res.write(data);
        if (typeof (client.res as any).flush === 'function') {
          (client.res as any).flush();
        }
      } catch (err) {
        console.error(`Failed to push SSE event to client ${client.id}:`, err);
      }
    }
  }

  close(): void {
    clearInterval(this.pingInterval);
    for (const client of this.clients) {
      try {
        client.res.end();
      } catch {
        // Ignore
      }
    }
    this.clients = [];
  }
}
