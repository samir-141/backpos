import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class ConsolidateDailySalesDto {
  @IsUUID()
  cajaId: string;

  @IsOptional()
  @IsUUID()
  perfilTributarioId?: string;

  @IsOptional()
  @IsDateString()
  fecha?: string; // YYYY-MM-DD
}
