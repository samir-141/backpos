import { Injectable, BadRequestException } from '@nestjs/common';
import { CreateInvoiceDto } from '../dtos/create-invoice.dto';
import { TipoDocumentoSunat, TipoDocumentoIdentidad } from '../sunat/catalogos.enum';

@Injectable()
export class FacturacionValidator {
  
  validar(dto: CreateInvoiceDto) {
    this.validarIdentidadCliente(dto);
    this.validarMontos(dto);
  }

  private validarIdentidadCliente(dto: CreateInvoiceDto) {
    const { tipoDocumento, cliente } = dto;

    if (tipoDocumento === TipoDocumentoSunat.FACTURA) {
      if (cliente.tipoDocumento !== TipoDocumentoIdentidad.RUC) {
        throw new BadRequestException('Para emitir una Factura (01) el cliente debe tener RUC (6).');
      }
      if (cliente.numeroDocumento.length !== 11) {
        throw new BadRequestException('El RUC debe tener 11 dígitos.');
      }
    }

    if (tipoDocumento === TipoDocumentoSunat.BOLETA) {
      if (dto.importeTotal >= 700) {
        if (cliente.tipoDocumento === TipoDocumentoIdentidad.DOC_TRIB_NO_DOMICILIADO || !cliente.numeroDocumento) {
          throw new BadRequestException('Para boletas mayores o iguales a 700 Soles, es obligatorio DNI o CE.');
        }
      }
    }
  }

  private validarMontos(dto: CreateInvoiceDto) {
    const EPSILON = 0.05; // Tolerancia por redondeo
    
    let sumGravadas = 0;
    let sumIgv = 0;
    
    dto.items.forEach(item => {
      sumGravadas += item.subtotal;
      sumIgv += item.igv;
    });

    if (Math.abs(dto.totalGravadas - sumGravadas) > EPSILON) {
      throw new BadRequestException(`El total de operaciones gravadas (${dto.totalGravadas}) no coincide con la suma de los items (${sumGravadas}).`);
    }

    if (Math.abs(dto.totalIgv - sumIgv) > EPSILON) {
      throw new BadRequestException(`El IGV total (${dto.totalIgv}) no coincide con la suma del IGV de los items (${sumIgv}).`);
    }

    const totalCalculado = dto.totalGravadas + dto.totalExoneradas + dto.totalInafectas + dto.totalIgv;
    if (Math.abs(dto.importeTotal - totalCalculado) > EPSILON) {
      throw new BadRequestException(`El importe total (${dto.importeTotal}) no coincide con la suma de las bases más impuestos (${totalCalculado}).`);
    }
  }
}
