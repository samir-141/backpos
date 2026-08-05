import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PrintingQzService } from './printing-qz.service';
import { SignRequestDto } from './dto/sign-request.dto';

@ApiTags('Impresión QZ Tray')
@ApiBearerAuth()
@Controller('printing-qz')
@UseGuards(AuthGuard('jwt'))
export class PrintingQzController {
  private readonly logger = new Logger(PrintingQzController.name);

  constructor(private readonly printingQzService: PrintingQzService) {}

  @Post('sign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Firmar solicitud para QZ Tray' })
  async sign(@Body() dto: SignRequestDto) {
    this.logger.log('Solicitud de firma QZ recibida.');

    if (!this.printingQzService.isConfigured()) {
      return {
        signature: '',
        warning: 'Clave privada no configurada. La firma no está habilitada.',
      };
    }

    const signature = this.printingQzService.signRequest(dto.request);
    if (!signature) {
      return {
        signature: '',
        warning:
          'Error al firmar la solicitud. Verifique la configuración de certificados.',
      };
    }

    return { signature };
  }

  @Post('certificate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obtener certificado público para QZ Tray' })
  getCertificate() {
    const cert = this.printingQzService.getCertificate();
    if (!cert) {
      return { certificate: '', warning: 'Certificado no configurado.' };
    }
    return { certificate: cert };
  }
}
