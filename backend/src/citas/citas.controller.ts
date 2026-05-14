import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query } from '@nestjs/common';
import { CitasService } from './citas.service';
import type {
  CalificarCitaDto,
  CitaActionDto,
  CreateSlotDto,
  CreateSolicitudDto,
  ListCitasQuery,
  ReprogramCitaDto,
  ReserveSlotDto,
  UpdateSlotDto,
} from './citas.types';

@Controller()
export class CitasController {
  constructor(private readonly citasService: CitasService) {}

  @Get('citas')
  list(@Query() query: ListCitasQuery) {
    return this.citasService.list(query);
  }

  @Post('citas/solicitar')
  solicitar(@Body() dto: CreateSolicitudDto) {
    return this.citasService.solicitar(dto);
  }

  @Post('citas/reservar')
  reservar(@Body() dto: ReserveSlotDto) {
    return this.citasService.reservar(dto);
  }

  @Patch('citas/:id/aceptar')
  accept(
    @Param('id') id: string,
    @Body() dto: CitaActionDto,
    @Headers('authorization') authorization?: string,
  ) {
    return this.citasService.accept(id, dto, authorization);
  }

  @Patch('citas/:id/rechazar')
  reject(
    @Param('id') id: string,
    @Body() dto: CitaActionDto,
    @Headers('authorization') authorization?: string,
  ) {
    return this.citasService.reject(id, dto, authorization);
  }

  @Patch('citas/:id/cancelar')
  cancel(@Param('id') id: string, @Body() dto: CitaActionDto) {
    return this.citasService.cancel(id, dto);
  }

  @Patch('citas/:id/reprogramar')
  reprogram(@Param('id') id: string, @Body() dto: ReprogramCitaDto) {
    return this.citasService.reprogram(id, dto);
  }

  @Post('citas/:id/calificar')
  calificar(@Param('id') id: string, @Body() dto: CalificarCitaDto) {
    return this.citasService.calificar(id, dto);
  }

  @Get('slots')
  listSlots(@Query('profileId') profileId?: string) {
    return this.citasService.listSlots(profileId);
  }

  @Post('slots')
  createSlot(@Body() dto: CreateSlotDto) {
    return this.citasService.createSlot(dto);
  }

  @Patch('slots/:id')
  updateSlot(@Param('id') id: string, @Body() dto: UpdateSlotDto) {
    return this.citasService.updateSlot(id, dto);
  }

  @Delete('slots/:id')
  deleteSlot(@Param('id') id: string, @Query('profileId') profileId: string) {
    return this.citasService.deleteSlot(id, profileId);
  }
}
