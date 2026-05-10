import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

const MULTER_CODE_MESSAGES: Record<string, string> = {
  LIMIT_FILE_SIZE:  'El archivo supera el tamaño máximo permitido (mín. 10 MB). Reduzca el archivo e intente de nuevo.',
  LIMIT_FILE_COUNT: 'Se superó el número máximo de archivos permitidos.',
  LIMIT_FIELD_KEY:  'Nombre de campo demasiado largo.',
  LIMIT_FIELD_VALUE:'Valor de campo demasiado largo.',
  LIMIT_UNEXPECTED_FILE: 'Tipo de archivo no esperado.',
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Error interno del servidor';
    let errors: any = null;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exResponse = exception.getResponse();
      if (typeof exResponse === 'string') {
        message = exResponse;
      } else if (typeof exResponse === 'object') {
        message = (exResponse as any).message || message;
        errors = (exResponse as any).errors || null;
      }
    } else if (
      exception instanceof Error &&
      (exception as any).code &&
      MULTER_CODE_MESSAGES[(exception as any).code]
    ) {
      // MulterError — tamaño, cantidad de archivos, etc.
      status  = HttpStatus.BAD_REQUEST;
      message = MULTER_CODE_MESSAGES[(exception as any).code];
    } else if (exception instanceof Error) {
      this.logger.error(`Unhandled error: ${exception.message}`, exception.stack);
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
      ...(errors && { errors }),
    });
  }
}
