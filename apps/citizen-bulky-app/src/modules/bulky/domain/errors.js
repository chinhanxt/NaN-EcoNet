export class BulkyServiceError extends Error {
  constructor(code, message = code, details) {
    super(message);
    this.name = 'BulkyServiceError';
    this.code = code;
    this.details = details;
  }
}
