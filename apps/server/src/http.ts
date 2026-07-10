import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export function parse<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new HttpError(400, 'VALIDATION', result.error.issues[0]?.message ?? 'Requête invalide');
  }
  return result.data;
}

export function requireUser(req: FastifyRequest): number {
  if (req.userId == null) throw new HttpError(401, 'UNAUTHENTICATED', 'Connexion requise');
  return req.userId;
}

export function sendError(reply: FastifyReply, status: number, code: string, message: string) {
  return reply.status(status).send({ error: code, message });
}

declare module 'fastify' {
  interface FastifyRequest {
    userId: number | null;
  }
}
