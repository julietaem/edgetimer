import { Controller, Get, Param, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import {
  CatalogosService,
  type UploadedBarberoPhotoFile,
  type UploadedClientePhotoFile,
} from './catalogos.service';

@Controller('catalogos')
export class CatalogosController {
  constructor(private readonly catalogosService: CatalogosService) {}

  @Get('barberos')
  barberos() {
    return this.catalogosService.barberos();
  }

  @Get('barberos/:id')
  barberoById(@Param('id') id: string) {
    return this.catalogosService.barberoById(id);
  }

  @Post('barberos/:id/foto')
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: memoryStorage(),
    }),
  )
  uploadBarberoFoto(@Param('id') id: string, @UploadedFile() file: UploadedBarberoPhotoFile) {
    return this.catalogosService.uploadBarberoPhoto(id, file);
  }

  @Post('clientes/:id/foto')
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: memoryStorage(),
    }),
  )
  uploadClienteFoto(@Param('id') id: string, @UploadedFile() file: UploadedClientePhotoFile) {
    return this.catalogosService.uploadClientePhoto(id, file);
  }

  @Get('procedimientos')
  procedimientos() {
    return this.catalogosService.procedimientos();
  }
}
