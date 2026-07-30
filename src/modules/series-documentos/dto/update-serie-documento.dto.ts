import { PartialType } from '@nestjs/swagger';
import { CreateSerieDocumentoDto } from './create-serie-documento.dto';

export class UpdateSerieDocumentoDto extends PartialType(CreateSerieDocumentoDto) {}
