// File: src/realtime/sse.ts
import { Response } from 'express';
import { CAPEvent } from '../shared/types.js';

export class SSEManager {
  private clients: Map<string, Set<Response>> = new Map();

  public addClient(res: Response, projectId: string): void {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    if (!this.clients.has(projectId)) {
      this.clients.set(projectId, new Set());
    }
    
    this.clients.get(projectId)!.add(res);

    res.on('close', () => {
      this.removeClient(res, projectId);
    });
  }

  public removeClient(res: Response, projectId: string): void {
    const projectClients = this.clients.get(projectId);
    if (projectClients) {
      projectClients.delete(res);
      if (projectClients.size === 0) {
        this.clients.delete(projectId);
      }
    }
  }

  public broadcast = (projectId: string, event: CAPEvent): void => {
    const projectClients = this.clients.get(projectId);
    if (projectClients) {
      const data = `data: ${JSON.stringify(event)}\n\n`;
      projectClients.forEach((client) => {
        client.write(data);
      });
    }
  };
}
