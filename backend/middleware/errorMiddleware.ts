import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction): void {
  console.error('[FinSight Server Error]', err);

  const statusCode = err.statusCode || err.status || 500;
  const message = err.isOperational ? err.message : (statusCode === 500 ? 'An unexpected server error occurred. Please try again.' : err.message);

  res.status(statusCode).json({
    success: false,
    message: message || 'An error occurred processing your request.',
  });
}
