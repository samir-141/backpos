
// src/prisma/prisma.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    constructor() {
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL,
        });
        const adapter = new PrismaPg(pool);
        super({ adapter });
    }

    async onModuleInit() {
        await this.$connect();
    }

    async onModuleDestroy() {
        await this.$disconnect();
    }

    /**
     * Ejecuta una query raw de forma segura con el adapter pg
     */
    async queryRaw<T = any>(query: string, params: any[] = []): Promise<T[]> {
        // $queryRawUnsafe es el método correcto para ejecutar strings SQL puros con @prisma/adapter-pg
        const result = await this.$queryRawUnsafe<T>(query, ...params);
        return result as T[];
    }
}