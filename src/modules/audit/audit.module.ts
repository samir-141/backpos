// src/modules/audit/audit.module.ts
import { Module, Global } from "@nestjs/common";
import { AuditService } from "./audit.service";
import { PrismaModule } from "../../prisma/prisma.module";

@Global()
@Module({
  imports: [PrismaModule],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
