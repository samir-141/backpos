// src/modules/diagnosticos/diagnosticos.controller.ts
import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { DiscoveryService, Reflector, MetadataScanner } from '@nestjs/core';
import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import {
  ROUTE_ARGS_METADATA,
  PATH_METADATA,
  METHOD_METADATA,
} from '@nestjs/common/constants';

import { EventsGateway } from '../../socket/events.gateway';
import { PlatformAdminGuard } from '../../auth/guards/platform-admin.guard';

@ApiTags('Diagnóstico')
@Controller('diagnosticos')
@UseGuards(AuthGuard('jwt'), PlatformAdminGuard)
export class DiagnosticosController {
  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly metadataScanner: MetadataScanner,
    private readonly reflector: Reflector,
    private readonly eventsGateway: EventsGateway,
  ) {}

  @Get('usuarios-conectados')
  @ApiOperation({
    summary:
      'Obtiene la lista de usuarios y sesiones conectadas en tiempo real',
  })
  obtenerUsuariosConectados() {
    const usuarios = this.eventsGateway.getUsuariosConectados();
    return {
      totalConectados: usuarios.length,
      usuarios,
    };
  }

  @Get('rutas')
  @ApiOperation({
    summary: 'Lista todas las rutas registradas en la aplicación',
  })
  @ApiResponse({ status: 200, description: 'Lista de rutas' })
  obtenerRutas() {
    const controllers = this.discoveryService.getControllers();
    const rutas: any[] = [];

    controllers.forEach((wrapper: InstanceWrapper) => {
      const { instance, name } = wrapper;
      if (!instance || !Object.getPrototypeOf(instance)) return;

      const controllerPath =
        this.reflector.get(PATH_METADATA, instance.constructor) || '';
      const prototype = Object.getPrototypeOf(instance);
      const methodNames = this.metadataScanner.getAllMethodNames(prototype);

      methodNames.forEach((methodName) => {
        const method = instance[methodName];
        if (!method) return;

        const httpMethod = this.reflector.get(METHOD_METADATA, method);
        const methodPath = this.reflector.get(PATH_METADATA, method) || '';

        if (httpMethod !== undefined) {
          const methodNames = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
          rutas.push({
            controller: name,
            metodo: methodNames[httpMethod] || 'UNKNOWN',
            ruta: `/${controllerPath}${methodPath ? '/' + methodPath : ''}`.replace(
              /\/+/g,
              '/',
            ),
            funcion: methodName,
          });
        }
      });
    });

    return {
      total: rutas.length,
      rutas: rutas.sort((a, b) => a.ruta.localeCompare(b.ruta)),
    };
  }

  @Get('modulos')
  @ApiOperation({ summary: 'Lista todos los módulos registrados' })
  obtenerModulos() {
    const providers = this.discoveryService.getProviders();
    const controllers = this.discoveryService.getControllers();

    return {
      totalModulos: new Set([...providers, ...controllers].map((p) => p.name))
        .size,
      totalProviders: providers.length,
      totalControllers: controllers.length,
    };
  }
}
