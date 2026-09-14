import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class QueryBibliotecaDto {
  @ApiPropertyOptional({
    description: 'Término de búsqueda (nombre, principio activo, marca)',
  })
  @IsString()
  @IsOptional()
  buscar?: string;

  @ApiPropertyOptional({ description: 'Página actual', default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Límite por página', default: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number = 20;
}
