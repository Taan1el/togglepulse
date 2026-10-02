export { ValidationError } from '../../shared/validate.js';

export class NotFoundError extends Error {
  code = 'NOT_FOUND' as const;

  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}
