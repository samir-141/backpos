import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SignRequestDto {
  @ApiProperty({ description: 'Contenido que QZ Tray necesita firmar' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  request: string;
}
