import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResolverDependenciasDto {
  @ApiProperty({ description: 'Código de barras a importar o resolver' })
  @IsString()
  @IsNotEmpty()
  codigo_barras: string;
}
