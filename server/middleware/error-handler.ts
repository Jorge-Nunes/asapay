import { Response } from 'express';

export function handleError(error: unknown, tag: string = 'Error'): { statusCode: number; message: string } {
  console.error(`[${tag}]`, error);
  if (error instanceof Error) return { statusCode: 500, message: error.message || 'Erro no servidor' };
  return { statusCode: 500, message: 'Erro desconhecido' };
}

export function sendError(res: Response, error: unknown, tag: string = 'Error', statusCode: number = 500) {
  const { message } = handleError(error, tag);
  res.status(statusCode).json({ error: message });
}
