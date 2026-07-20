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
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            // 1. Añadimos <string> y el signo ! al final
            secretOrKey: configService.get<string>('JWT_SECRET')!,
        });
    }

    async validate(payload: any) {
        const usuario = await this.prisma.usuarios.findUnique({
            where: { id: payload.sub },
            include: { roles: true },
        });

        if (!usuario || usuario.estado !== 'ACTIVO') {
            throw new UnauthorizedException('Usuario no autorizado');
        }

        return {
            id: usuario.id,
            correo: usuario.correo,
            nombre: usuario.nombre,
            rol: usuario.roles.nombre,
            sucursal_id: payload.sucursal_id,
        };
    }
}