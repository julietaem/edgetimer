import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CitasService } from './citas.service';
import type { CreateCitaDto } from './citas.types';

@Controller('citas')
export class CitasController {
  constructor(private readonly citasService: CitasService) {}

  @Get()
  list(@Query('role') role: string, @Query('profileId') profileId: string) {
    return this.citasService.list(role, profileId);
  }

  @Post()
  create(@Body() createCitaDto: CreateCitaDto) {
    return this.citasService.create(createCitaDto);
  }
}

