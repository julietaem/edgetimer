import { Controller, Get } from '@nestjs/common';
import { CatalogosService } from './catalogos.service';

@Controller('catalogos')
export class CatalogosController {
  constructor(private readonly catalogosService: CatalogosService) {}

  @Get('barberos')
  barberos() {
    return this.catalogosService.barberos();
  }

  @Get('procedimientos')
  procedimientos() {
    return this.catalogosService.procedimientos();
  }
}
