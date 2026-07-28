// src/common/filters/http-exception.filter.ts
// Filtro global de excepciones para respuestas JSON limpias y sanitización de errores de BD/Prisma
// (Sección 24 del Documento 02 de Arquitectura)

import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Request, Response } from "express";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = "Ocurrió un error interno en el servidor.";

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === "string") {
        message = res;
      } else if (typeof res === "object" && res !== null) {
        message = (res as any).message || (res as any).error || message;
        if (Array.isArray(message)) {
          message = message.join(", ");
        }
      }
    } else if (exception && typeof exception === "object") {
      const err = exception as any;
      // Tratar errores de Prisma de forma segura sin exponer stack traces
      if (err.code === "P2002") {
        status = HttpStatus.CONFLICT;
        message = "Ya existe un registro con esos datos únicos en el sistema.";
      } else if (err.code === "P2025") {
        status = HttpStatus.NOT_FOUND;
        message = "El registro solicitado no existe o fue eliminado.";
      } else if (err.code === "P2003") {
        status = HttpStatus.BAD_REQUEST;
        message = "Violación de restricción de clave foránea en la base de datos.";
      } else if (err.message) {
        this.logger.error(`Error no controlado: ${err.message}`, err.stack);
      }
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
