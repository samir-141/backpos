import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { TaxEngineService } from './services/tax-engine.service';
import { TaxValidatorService } from './services/tax-validator.service';
import { ConsolidationService } from './services/consolidation.service';
import { SyncQueueService } from './services/sync-queue.service';
import { NrusRuleStrategy } from './rules/nrus-rule.strategy';
import { RmtRuleStrategy } from './rules/rmt-rule.strategy';
import { RerRuleStrategy } from './rules/rer-rule.strategy';
import { GeneralRuleStrategy } from './rules/general-rule.strategy';
import { TaxEngineController } from './controllers/tax-engine.controller';

@Module({
  imports: [PrismaModule],
  controllers: [TaxEngineController],
  providers: [
    TaxValidatorService,
    NrusRuleStrategy,
    RmtRuleStrategy,
    RerRuleStrategy,
    GeneralRuleStrategy,
    TaxEngineService,
    ConsolidationService,
    SyncQueueService,
  ],
  exports: [
    TaxEngineService,
    TaxValidatorService,
    ConsolidationService,
    SyncQueueService,
  ],
})
export class TaxEngineModule {}
