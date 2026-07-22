import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class FindProductos {
    @IsOptional()
    @IsString()
    search?: string;

    @IsOptional()
    @IsString()
    sucursalId?: string;
}