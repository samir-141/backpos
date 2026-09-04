import { PartialType } from '@nestjs/swagger';
import { CreatePerfilTributarioDto } from './create-perfil-tributario.dto';

export class UpdatePerfilTributarioDto extends PartialType(
  CreatePerfilTributarioDto,
) {}
