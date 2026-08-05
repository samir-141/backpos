// src/auth/strategies/jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    const secret = configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error(
        'JWT_SECRET no está definido. Configúralo en el entorno (ver .env.example).',
      );
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: any) {
    const usuario = await this.prisma.usuarios.findUnique({
      where: { id: payload.sub },
      include: { roles: true },
    });

    if (!usuario || usuario.deleted_at || usuario.estado !== 'ACTIVO') {
      throw new UnauthorizedException('Usuario no autorizado');
    }

    return {
      id: usuario.id,
      correo: usuario.correo,
      nombre: usuario.nombre,
      rol: usuario.roles?.nombre || 'SIN_ROL',
      botica_id: usuario.botica_id,
      sucursal_id: payload.sucursal_id,
      es_super_admin: usuario.es_super_admin,
    };
  }
}
