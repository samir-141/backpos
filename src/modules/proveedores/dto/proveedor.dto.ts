import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateProveedorDto {
  @Transform(trim)
  @IsString()
  @Matches(/^\d{11}$/, {
    message: 'El RUC debe contener exactamente 11 dígitos.',
  })
  ruc: string;

  @Transform(trim)
  @IsString()
  @Length(2, 150)
  razon_social: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  direccion?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(20)
  telefono?: string;

  @Transform(trim)
  @IsOptional()
  @IsEmail()
  @MaxLength(100)
  email?: string;
}

export class UpdateProveedorDto {
  @Transform(trim)
  @IsOptional()
  @IsString()
  @Matches(/^\d{11}$/, {
    message: 'El RUC debe contener exactamente 11 dígitos.',
  })
  ruc?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @Length(2, 150)
  razon_social?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  direccion?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(20)
  telefono?: string;

  @Transform(trim)
  @IsOptional()
  @IsEmail()
  @MaxLength(100)
  email?: string;
}

export class QueryProveedoresDto {
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(150)
  buscar?: string;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  page = 1;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
