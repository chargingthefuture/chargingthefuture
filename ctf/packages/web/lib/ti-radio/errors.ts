import type { TiRadioErrorCode } from './constants';

/**
 * A typed failure the routes turn into an error code and an HTTP status, so the SQL layer never has
 * to know about HTTP and the routes never have to guess which failure they caught.
 */
export class TiRadioError extends Error {
  code: TiRadioErrorCode;

  constructor(code: TiRadioErrorCode, message: string) {
    super(message);
    this.name = 'TiRadioError';
    this.code = code;
  }
}
