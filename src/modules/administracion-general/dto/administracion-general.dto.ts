import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

const ESTADOS = ['ACTIVO', 'INACTIVO'] as const;

const trimString = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const emptyStringToUndefined = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' && value.trim() === ''
    ? undefined
    : typeof value === 'string'
      ? value.trim()
      : value;

export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  buscar = '';
}

export class CreateBoticaDto {
  @IsString()
  @IsNotEmpty()
  @Transform(trimString)
  nombre: string;

  @IsString()
  @IsNotEmpty()
  @Transform(trimString)
  razon_social: string;

  @IsString()
  @Length(11, 11)
  @Matches(/^\d{11}$/)
  @Transform(trimString)
  ruc: string;

  @IsOptional()
  @IsString()
  @Transform(emptyStringToUndefined)
  direccion?: string;

  @IsOptional()
  @IsString()
  @Transform(emptyStringToUndefined)
  telefono?: string;

  @IsOptional()
  @IsEmail()
  @Transform(emptyStringToUndefined)
  email?: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, {
    message:
      'El dominio de la empresa debe tener un formato válido (ej: empresa.pe)',
  })
  @Transform(trimString)
  dominio: string;

  @IsString()
  @IsNotEmpty()
  @Transform(trimString)
  sucursal_nombre: string;

  @IsOptional()
  @IsString()
  @Transform(emptyStringToUndefined)
  sucursal_direccion?: string;

  @IsOptional()
  @IsString()
  @Transform(emptyStringToUndefined)
  sucursal_telefono?: string;

  @Transform(emptyStringToUndefined)
  @ValidateIf((o: CreateBoticaDto) =>
    Boolean(
      o.responsable_nombre || o.responsable_correo || o.responsable_password,
    ),
  )
  @IsString()
  @IsNotEmpty()
  responsable_nombre?: string;

  @Transform(emptyStringToUndefined)
  @ValidateIf((o: CreateBoticaDto) =>
    Boolean(
      o.responsable_nombre || o.responsable_correo || o.responsable_password,
    ),
  )
  @IsEmail()
  responsable_correo?: string;

  @Transform(emptyStringToUndefined)
  @ValidateIf((o: CreateBoticaDto) =>
    Boolean(
      o.responsable_nombre || o.responsable_correo || o.responsable_password,
    ),
  )
  @IsString()
  @MinLength(6)
  responsable_password?: string;
}

export class UpdateBoticaDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Transform(emptyStringToUndefined)
  nombre?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Transform(emptyStringToUndefined)
  razon_social?: string;

  @IsOptional()
  @IsString()
  @Length(11, 11)
  @Matches(/^\d{11}$/)
  @Transform(emptyStringToUndefined)
  ruc?: string;

  @IsOptional()
  @IsString()
  @Transform(emptyStringToUndefined)
  direccion?: string;

  @IsOptional()
  @IsString()
  @Transform(emptyStringToUndefined)
  telefono?: string;

  @IsOptional()
  @IsEmail()
  @Transform(emptyStringToUndefined)
  email?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, {
    message:
      'El dominio de la empresa debe tener un formato válido (ej: empresa.pe)',
  })
  @Transform(emptyStringToUndefined)
  dominio?: string;

  @IsOptional()
  @IsIn(ESTADOS)
  estado?: (typeof ESTADOS)[number];
}

export class CreateSucursalDto {
  @IsString()
  @IsNotEmpty()
  @Transform(trimString)
  nombre: string;

  @IsString()
  @IsNotEmpty()
  @Transform(trimString)
  direccion: string;

  @IsOptional()
  @IsString()
  @Transform(emptyStringToUndefined)
  telefono?: string;
}

export class UpdateSucursalDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Transform(emptyStringToUndefined)
  nombre?: string;

  @IsOptional()
  @IsString()
  @Transform(emptyStringToUndefined)
  direccion?: string;

  @IsOptional()
  @IsString()
  @Transform(emptyStringToUndefined)
  telefono?: string;
}

export class CreateColaboradorDto {
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsEmail()
  correo: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsUUID()
  rol_id: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Debe asignar al menos una sucursal.' })
  @ArrayUnique({ message: 'No debe repetir sucursales.' })
  @IsUUID('4', { each: true })
  sucursal_ids: string[];

  @IsOptional()
  @IsIn(ESTADOS)
  estado?: (typeof ESTADOS)[number];
}

export class UpdateColaboradorDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Transform(emptyStringToUndefined)
  nombre?: string;

  @IsOptional()
  @IsEmail()
  @Transform(emptyStringToUndefined)
  correo?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  @Transform(emptyStringToUndefined)
  password?: string;

  @IsOptional()
  @IsUUID()
  rol_id?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1, { message: 'Debe asignar al menos una sucursal.' })
  @ArrayUnique({ message: 'No debe repetir sucursales.' })
  @IsUUID('4', { each: true })
  sucursal_ids?: string[];

  @IsOptional()
  @IsIn(ESTADOS)
  estado?: (typeof ESTADOS)[number];
}

export class UpdateEstadoBoticaDto {
  @IsIn(ESTADOS)
  estado: (typeof ESTADOS)[number];
}
