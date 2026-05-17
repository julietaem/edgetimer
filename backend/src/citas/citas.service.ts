import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { createSupabaseUserClient, getSignedStorageUrl, supabaseAdmin } from '../supabase';
import type {
  CalificarCitaDto,
  CitaActionDto,
  CreateSlotDto,
  CreateSolicitudDto,
  EstadoCita,
  ListCitasQuery,
  ReprogramCitaDto,
  ReserveSlotDto,
  UpdateSlotDto,
} from './citas.types';

const TIME_ZONE_OFFSET = '-05:00';
const MIN_SLOT_MINUTES = 15;
const SLOT_DURATION_MINUTES = 15;
const BUSINESS_START_MINUTES = 8 * 60;
const BUSINESS_END_MINUTES = 18 * 60;

@Injectable()
export class CitasService {
  async list(query: ListCitasQuery) {
    this.requireText(query.profileId, 'Falta el perfil');
    await this.realizarCitasVencidas();

    const column = query.role === 'barbero' ? 'id_barbero' : 'id_cliente';

    let request = supabaseAdmin
      .from('cita')
      .select(
        `
          id_cita,
          id_cliente,
          id_barbero,
          id_slot,
          inicio_at,
          fin_at,
          estado,
          notas_cliente,
          cliente:cliente(id_cliente, nombre_cliente, foto_perfil),
          barbero:barbero(id_barbero, nombre_barbero, foto_perfil, promedio_calificacion),
          cita_procedimiento(
            procedimiento:procedimiento(id_procedimiento, nombre, precio, duracion_minutos)
          ),
          calificacion(puntuacion_numerica, resena)
        `,
      )
      .eq(column, query.profileId)
      .order('inicio_at', { ascending: true });

    if (query.estado) {
      request = request.eq('estado', query.estado);
    }

    const { data, error } = await request;

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return Promise.all((data || []).map((cita: any) => this.mapCita(cita)));
  }

  async listSlots(profileId?: string) {
    let request = supabaseAdmin
      .from('slot_cita')
      .select(
        `
          id_slot,
          id_barbero,
          inicio_at,
          fin_at,
          estado,
          barbero:barbero(id_barbero, nombre_barbero, foto_perfil, promedio_calificacion)
        `,
      )
      .eq('estado', 'pendiente')
      .gte('inicio_at', new Date().toISOString())
      .order('inicio_at', { ascending: true });

    if (profileId) {
      request = request.eq('id_barbero', profileId);
    }

    const { data, error } = await request;

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    const slots = data || [];
    const citasActivas = await this.findActiveCitasForSlots(
      slots.map((slot: any) => slot.id_barbero),
    );

    return Promise.all(
      slots
        .filter((slot: any) => !this.overlapsAnyCita(slot, citasActivas))
        .map((slot: any) => this.mapSlot(slot)),
    );
  }

  async createSlot(dto: CreateSlotDto) {
    const profileId = this.requireText(dto.profileId, 'Falta el perfil');
    const inicioAt = this.toDate(dto.fecha, dto.horaInicio);
    const finAt = this.addMinutes(inicioAt, SLOT_DURATION_MINUTES);
    this.validateRange(inicioAt, finAt);
    this.validateBusinessHours(inicioAt, finAt);
    await this.ensureNoBarberCitaOverlap(profileId, inicioAt, finAt);

    const { data, error } = await supabaseAdmin
      .from('slot_cita')
      .insert({
        id_barbero: profileId,
        inicio_at: inicioAt.toISOString(),
        fin_at: finAt.toISOString(),
        estado: 'pendiente',
      })
      .select(
        `
          id_slot,
          id_barbero,
          inicio_at,
          fin_at,
          estado,
          barbero:barbero(id_barbero, nombre_barbero, foto_perfil, promedio_calificacion)
        `,
      )
      .single();

    if (error) {
      this.throwSupabaseError(error.message);
    }

    return {
      message: 'Horario disponible creado exitosamente.',
      slot: await this.mapSlot(data),
    };
  }

  async updateSlot(slotId: string, dto: UpdateSlotDto) {
    const current = await this.findSlot(slotId);
    this.ensureOwner(current.id_barbero, dto.profileId);

    if (current.estado !== 'pendiente') {
      throw new BadRequestException('Solo puedes editar horarios pendientes.');
    }

    const inicioAt = this.toDate(dto.fecha, dto.horaInicio);
    const finAt = this.addMinutes(inicioAt, SLOT_DURATION_MINUTES);
    this.validateRange(inicioAt, finAt);
    this.validateBusinessHours(inicioAt, finAt);
    await this.ensureNoBarberCitaOverlap(current.id_barbero, inicioAt, finAt);

    const { data, error } = await supabaseAdmin
      .from('slot_cita')
      .update({
        inicio_at: inicioAt.toISOString(),
        fin_at: finAt.toISOString(),
      })
      .eq('id_slot', slotId)
      .select(
        `
          id_slot,
          id_barbero,
          inicio_at,
          fin_at,
          estado,
          barbero:barbero(id_barbero, nombre_barbero, foto_perfil, promedio_calificacion)
        `,
      )
      .single();

    if (error) {
      this.throwSupabaseError(error.message);
    }

    return {
      message: 'Horario actualizado.',
      slot: await this.mapSlot(data),
    };
  }

  async deleteSlot(slotId: string, profileId: string) {
    const current = await this.findSlot(slotId);
    this.ensureOwner(current.id_barbero, profileId);

    if (current.estado !== 'pendiente') {
      throw new BadRequestException('Solo puedes eliminar horarios pendientes.');
    }

    const { error } = await supabaseAdmin
      .from('slot_cita')
      .update({ estado: 'cancelado' })
      .eq('id_slot', slotId);

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return { message: 'Horario eliminado.' };
  }

  async solicitar(dto: CreateSolicitudDto) {
    const profileId = this.requireText(dto.profileId, 'Falta el perfil');
    const procedimientoIds = this.requireIds(dto.procedimientoIds);
    const procedimientos = await this.findProcedimientos(procedimientoIds);
    const inicioAt = this.toDate(dto.fecha, dto.horaInicio);
    const finAt = this.addMinutes(
      inicioAt,
      procedimientos.reduce((total, item) => total + item.duracion_minutos, 0),
    );
    this.validateRange(inicioAt, finAt);
    this.validateBusinessHours(inicioAt, finAt);

    const { data, error } = await supabaseAdmin
      .from('cita')
      .insert({
        id_cliente: profileId,
        id_barbero: this.requireText(dto.idBarbero, 'Selecciona un barbero'),
        inicio_at: inicioAt.toISOString(),
        fin_at: finAt.toISOString(),
        estado: 'pendiente',
        notas_cliente: dto.notas || null,
      })
      .select('id_cita')
      .single();

    if (error) {
      this.throwSupabaseError(error.message);
    }

    await this.insertProcedimientos(data.id_cita, procedimientoIds);

    return {
      message: 'Solicitud enviada. Espera la confirmacion del barbero.',
      cita: await this.findCita(data.id_cita),
    };
  }

  async reservar(dto: ReserveSlotDto) {
    const profileId = this.requireText(dto.profileId, 'Falta el perfil');
    const procedimientoIds = this.requireIds(dto.procedimientoIds);
    const slot = await this.findSlot(dto.slotId);

    if (slot.estado !== 'pendiente') {
      throw new BadRequestException('El horario seleccionado no esta disponible.');
    }

    const procedimientos = await this.findProcedimientos(procedimientoIds);
    const inicioAt = new Date(slot.inicio_at);
    const finAt = this.addMinutes(
      inicioAt,
      procedimientos.reduce((total, item) => total + item.duracion_minutos, 0),
    );
    this.validateRange(inicioAt, finAt);
    this.validateBusinessHours(inicioAt, finAt);

    const { data, error } = await supabaseAdmin
      .from('cita')
      .insert({
        id_cliente: profileId,
        id_barbero: slot.id_barbero,
        id_slot: slot.id_slot,
        inicio_at: slot.inicio_at,
        fin_at: finAt.toISOString(),
        estado: 'confirmada',
        notas_cliente: dto.notas || null,
      })
      .select('id_cita')
      .single();

    if (error) {
      this.throwSupabaseError(error.message);
    }

    await this.insertProcedimientos(data.id_cita, procedimientoIds);

    return {
      message: 'Cita reservada exitosamente.',
      cita: await this.findCita(data.id_cita),
    };
  }

  async accept(citaId: string, dto: CitaActionDto, authorization?: string) {
    const cita = await this.findCitaRaw(citaId);
    this.ensureOwner(cita.id_barbero, dto.profileId);

    if (cita.estado !== 'pendiente') {
      throw new BadRequestException('Solo puedes aceptar solicitudes pendientes.');
    }

    return this.updateEstado(citaId, 'confirmada', 'Solicitud aceptada.', authorization);
  }

  async reject(citaId: string, dto: CitaActionDto, authorization?: string) {
    const cita = await this.findCitaRaw(citaId);
    this.ensureOwner(cita.id_barbero, dto.profileId);

    if (cita.estado !== 'pendiente') {
      throw new BadRequestException('Solo puedes rechazar solicitudes pendientes.');
    }

    return this.updateEstado(citaId, 'rechazada', 'Solicitud rechazada.', authorization);
  }

  async cancel(citaId: string, dto: CitaActionDto) {
    const cita = await this.findCitaRaw(citaId);
    const ownerId = dto.role === 'barbero' ? cita.id_barbero : cita.id_cliente;
    this.ensureOwner(ownerId, dto.profileId);
    this.ensureCanModify(cita.inicio_at);

    return this.updateEstado(citaId, 'cancelada', 'Cita cancelada.');
  }

  async reprogram(citaId: string, dto: ReprogramCitaDto) {
    const cita = await this.findCitaRaw(citaId);
    const ownerId = dto.role === 'barbero' ? cita.id_barbero : cita.id_cliente;
    this.ensureOwner(ownerId, dto.profileId);
    this.ensureCanModify(cita.inicio_at);

    const duration = await this.findCitaDuration(citaId);
    const inicioAt = this.toDate(dto.fecha, dto.horaInicio);
    const finAt = this.addMinutes(inicioAt, duration);
    if (dto.horaFin) {
      const requestedFinAt = this.toDate(dto.fecha, dto.horaFin);
      if (requestedFinAt.getTime() !== finAt.getTime()) {
        throw new BadRequestException(
          'La hora de fin debe coincidir con la duracion de los procedimientos.',
        );
      }
    }
    this.validateRange(inicioAt, finAt);
    this.validateBusinessHours(inicioAt, finAt);

    const { data, error } = await supabaseAdmin
      .from('cita')
      .update({
        inicio_at: inicioAt.toISOString(),
        fin_at: finAt.toISOString(),
      })
      .eq('id_cita', citaId)
      .select(
        `
          id_cita,
          id_cliente,
          id_barbero,
          id_slot,
          inicio_at,
          fin_at,
          estado,
          notas_cliente,
          cliente:cliente(id_cliente, nombre_cliente, foto_perfil),
          barbero:barbero(id_barbero, nombre_barbero, foto_perfil, promedio_calificacion),
          cita_procedimiento(
            procedimiento:procedimiento(id_procedimiento, nombre, precio, duracion_minutos)
          ),
          calificacion(puntuacion_numerica, resena)
        `,
      )
      .single();

    if (error) {
      this.throwSupabaseError(error.message);
    }

    return {
      message: 'Cita reprogramada.',
      cita: await this.mapCita(data),
    };
  }

  async calificar(citaId: string, dto: CalificarCitaDto) {
    const cita = await this.findCitaRaw(citaId);
    this.ensureOwner(cita.id_cliente, dto.profileId);

    const puntuacion = Number(dto.puntuacion);
    if (!Number.isInteger(puntuacion) || puntuacion < 1 || puntuacion > 5) {
      throw new BadRequestException('La calificacion debe estar entre 1 y 5.');
    }

    if (cita.estado !== 'realizada') {
      throw new BadRequestException('Solo puedes calificar una cita realizada.');
    }

    const { error } = await supabaseAdmin
      .from('calificacion')
      .upsert(
        {
          id_cita: citaId,
          puntuacion_numerica: puntuacion,
          resena: dto.resena || null,
        },
        { onConflict: 'id_cita' },
      );

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return {
      message: 'Calificacion guardada.',
      cita: await this.findCita(citaId),
    };
  }

  private async updateEstado(
    citaId: string,
    estado: EstadoCita,
    message: string,
    authorization?: string,
  ) {
    const client = this.getActionClient(authorization);
    const { data, error } = await client
      .from('cita')
      .update({ estado })
      .eq('id_cita', citaId)
      .select(
        `
          id_cita,
          id_cliente,
          id_barbero,
          id_slot,
          inicio_at,
          fin_at,
          estado,
          notas_cliente,
          cliente:cliente(id_cliente, nombre_cliente, foto_perfil),
          barbero:barbero(id_barbero, nombre_barbero, foto_perfil, promedio_calificacion),
          cita_procedimiento(
            procedimiento:procedimiento(id_procedimiento, nombre, precio, duracion_minutos)
          ),
          calificacion(puntuacion_numerica, resena)
        `,
      )
      .single();

    if (error) {
      this.throwSupabaseError(error.message);
    }

    return {
      message,
      cita: await this.mapCita(data),
    };
  }

  private async realizarCitasVencidas() {
    const { error } = await supabaseAdmin
      .from('cita')
      .update({ estado: 'realizada' })
      .eq('estado', 'confirmada')
      .lt('fin_at', new Date().toISOString());

    if (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  private async findCita(citaId: string) {
    const { data, error } = await supabaseAdmin
      .from('cita')
      .select(
        `
          id_cita,
          id_cliente,
          id_barbero,
          id_slot,
          inicio_at,
          fin_at,
          estado,
          notas_cliente,
          cliente:cliente(id_cliente, nombre_cliente, foto_perfil),
          barbero:barbero(id_barbero, nombre_barbero, foto_perfil, promedio_calificacion),
          cita_procedimiento(
            procedimiento:procedimiento(id_procedimiento, nombre, precio, duracion_minutos)
          ),
          calificacion(puntuacion_numerica, resena)
        `,
      )
      .eq('id_cita', citaId)
      .single();

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return this.mapCita(data);
  }

  private async findCitaRaw(citaId: string) {
    const { data, error } = await supabaseAdmin
      .from('cita')
      .select('id_cita, id_cliente, id_barbero, inicio_at, fin_at, estado')
      .eq('id_cita', citaId)
      .single();

    if (error || !data) {
      throw new NotFoundException('No se encontro la cita.');
    }

    return data as any;
  }

  private async findSlot(slotId: string) {
    const { data, error } = await supabaseAdmin
      .from('slot_cita')
      .select('id_slot, id_barbero, inicio_at, fin_at, estado')
      .eq('id_slot', slotId)
      .single();

    if (error || !data) {
      throw new NotFoundException('No se encontro el horario.');
    }

    return data as any;
  }

  private async findProcedimientos(ids: string[]) {
    const { data, error } = await supabaseAdmin
      .from('procedimiento')
      .select('id_procedimiento, duracion_minutos')
      .in('id_procedimiento', ids)
      .eq('activo', true);

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    if (!data || data.length !== ids.length) {
      throw new BadRequestException('Selecciona procedimientos validos.');
    }

    return data as { id_procedimiento: string; duracion_minutos: number }[];
  }

  private async findCitaDuration(citaId: string) {
    const { data, error } = await supabaseAdmin
      .from('cita_procedimiento')
      .select('procedimiento:procedimiento(duracion_minutos)')
      .eq('id_cita', citaId);

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    const duration = (data || []).reduce((total: number, item: any) => {
      const procedimiento = Array.isArray(item.procedimiento)
        ? item.procedimiento[0]
        : item.procedimiento;

      return total + Number(procedimiento?.duracion_minutos || 0);
    }, 0);

    if (duration <= 0) {
      throw new BadRequestException('La cita no tiene procedimientos validos.');
    }

    return duration;
  }

  private async findActiveCitasForSlots(barberoIds: string[]) {
    const ids = [...new Set(barberoIds.filter(Boolean))];
    if (ids.length === 0) {
      return [];
    }

    const { data, error } = await supabaseAdmin
      .from('cita')
      .select('id_barbero, inicio_at, fin_at')
      .in('id_barbero', ids)
      .in('estado', ['pendiente', 'confirmada'])
      .gt('fin_at', new Date().toISOString());

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return data || [];
  }

  private async ensureNoBarberCitaOverlap(
    barberoId: string,
    inicioAt: Date,
    finAt: Date,
  ) {
    const { data, error } = await supabaseAdmin
      .from('cita')
      .select('id_cita')
      .eq('id_barbero', barberoId)
      .in('estado', ['pendiente', 'confirmada'])
      .lt('inicio_at', finAt.toISOString())
      .gt('fin_at', inicioAt.toISOString())
      .limit(1);

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    if (data && data.length > 0) {
      throw new BadRequestException('Ya tienes una cita en ese horario.');
    }
  }

  private overlapsAnyCita(slot: any, citas: any[]) {
    const start = new Date(slot.inicio_at).getTime();
    const end = new Date(slot.fin_at).getTime();

    return citas.some((cita) => {
      if (cita.id_barbero !== slot.id_barbero) {
        return false;
      }

      return (
        new Date(cita.inicio_at).getTime() < end &&
        new Date(cita.fin_at).getTime() > start
      );
    });
  }

  private async insertProcedimientos(citaId: string, procedimientoIds: string[]) {
    const { error } = await supabaseAdmin.from('cita_procedimiento').insert(
      procedimientoIds.map((id) => ({
        id_cita: citaId,
        id_procedimiento: id,
      })),
    );

    if (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  private async mapCita(cita: any) {
    const procedimientos = (cita.cita_procedimiento || [])
      .map((item: any) => item.procedimiento)
      .filter(Boolean);
    const total = procedimientos.reduce(
      (sum: number, item: any) => sum + Number(item.precio || 0),
      0,
    );
    const calificacion = Array.isArray(cita.calificacion)
      ? cita.calificacion[0]
      : cita.calificacion;

    return {
      id: cita.id_cita,
      cliente: {
        id: cita.id_cliente,
        nombre: cita.cliente?.nombre_cliente || 'Cliente',
        foto: await getSignedStorageUrl(cita.cliente?.foto_perfil),
      },
      barbero: {
        id: cita.id_barbero,
        nombre: cita.barbero?.nombre_barbero || 'Barbero',
        foto: await getSignedStorageUrl(cita.barbero?.foto_perfil),
        promedioCalificacion: Number(cita.barbero?.promedio_calificacion || 0),
      },
      slotId: cita.id_slot,
      procedimientos: procedimientos.map((item: any) => ({
        id: item.id_procedimiento,
        nombre: item.nombre,
        precio: Number(item.precio || 0),
        duracionMinutos: item.duracion_minutos,
      })),
      costoTotal: total,
      inicioAt: cita.inicio_at,
      finAt: cita.fin_at,
      fecha: this.formatDate(cita.inicio_at),
      horaInicio: this.formatHour(cita.inicio_at),
      horaFin: this.formatHour(cita.fin_at),
      estado: cita.estado,
      estadoLabel: this.estadoLabel(cita.estado),
      notas: cita.notas_cliente || '',
      puedeModificar: this.canModify(cita.inicio_at),
      calificacion: calificacion
        ? {
            puntuacion: calificacion.puntuacion_numerica,
            resena: calificacion.resena || '',
          }
        : null,
    };
  }

  private async mapSlot(slot: any) {
    return {
      id: slot.id_slot,
      barbero: {
        id: slot.id_barbero,
        nombre: slot.barbero?.nombre_barbero || 'Barbero',
        foto: await getSignedStorageUrl(slot.barbero?.foto_perfil),
        promedioCalificacion: Number(slot.barbero?.promedio_calificacion || 0),
      },
      inicioAt: slot.inicio_at,
      finAt: slot.fin_at,
      fecha: this.formatDate(slot.inicio_at),
      horaInicio: this.formatHour(slot.inicio_at),
      horaFin: this.formatHour(slot.fin_at),
      estado: slot.estado,
    };
  }

  private toDate(fecha: string, hora: string) {
    const cleanFecha = this.requireText(fecha, 'Selecciona la fecha');
    const cleanHora = this.requireText(hora, 'Selecciona la hora');

    if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanFecha)) {
      throw new BadRequestException('Fecha invalida.');
    }

    const timeMatch = cleanHora.match(/^(\d{2}):(\d{2})$/);
    if (!timeMatch) {
      throw new BadRequestException('Hora invalida.');
    }

    const date = new Date(`${cleanFecha}T${cleanHora}:00${TIME_ZONE_OFFSET}`);
    const day = date.getUTCDay();
    if (day === 0 || day === 6) {
      throw new BadRequestException('Solo se permiten horarios de lunes a viernes.');
    }

    return date;
  }

  private validateRange(inicioAt: Date, finAt: Date) {
    if (finAt <= inicioAt) {
      throw new BadRequestException('La hora de fin debe ser posterior a la hora de inicio.');
    }

    const minutes = (finAt.getTime() - inicioAt.getTime()) / 60000;
    if (minutes < MIN_SLOT_MINUTES) {
      throw new BadRequestException('El horario debe durar al menos 15 minutos.');
    }
  }

  private validateBusinessHours(inicioAt: Date, finAt: Date) {
    if (this.formatDate(inicioAt.toISOString()) !== this.formatDate(finAt.toISOString())) {
      throw new BadRequestException('La cita debe terminar el mismo dia laboral.');
    }

    const startMinutes = this.minutesFromDate(inicioAt);
    const endMinutes = this.minutesFromDate(finAt);

    if (startMinutes < BUSINESS_START_MINUTES || endMinutes > BUSINESS_END_MINUTES) {
      throw new BadRequestException('El horario debe estar entre 08:00 y 18:00.');
    }
  }

  private minutesFromDate(value: Date) {
    const [hours, minutes] = this.formatHour(value.toISOString())
      .split(':')
      .map((part) => Number(part));

    return hours * 60 + minutes;
  }

  private addMinutes(date: Date, minutes: number) {
    return new Date(date.getTime() + minutes * 60000);
  }

  private ensureOwner(ownerId: string, profileId: string) {
    if (ownerId !== profileId) {
      throw new ForbiddenException('No tienes permisos para esta accion.');
    }
  }

  private ensureCanModify(inicioAt: string) {
    if (!this.canModify(inicioAt)) {
      throw new BadRequestException(
        'Solo puedes modificar citas con al menos 1 dia de antelacion.',
      );
    }
  }

  private canModify(inicioAt: string) {
    return new Date(inicioAt).getTime() - Date.now() >= 24 * 60 * 60 * 1000;
  }

  private requireIds(ids: string[] | undefined) {
    if (!ids || ids.length === 0) {
      throw new BadRequestException('Selecciona al menos un procedimiento.');
    }

    return ids;
  }

  private requireText(value: string | undefined, message: string) {
    if (!value || value.trim().length === 0) {
      throw new BadRequestException(message);
    }

    return value.trim();
  }

  private formatDate(value: string) {
    return new Date(value).toLocaleDateString('en-CA', {
      timeZone: 'America/Bogota',
    });
  }

  private formatHour(value: string) {
    return new Date(value).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'America/Bogota',
    });
  }

  private estadoLabel(estado: EstadoCita) {
    const labels: Record<EstadoCita, string> = {
      pendiente: 'Pendiente',
      confirmada: 'Confirmada',
      realizada: 'Realizada',
      cancelada: 'Cancelada',
      rechazada: 'Rechazada',
    };

    return labels[estado] || estado;
  }

  private throwSupabaseError(message: string): never {
    if (message.includes('no_citas_solapadas_cliente')) {
      throw new BadRequestException('Ya tienes una cita en ese rango. Elige otro horario.');
    }

    if (message.includes('no_citas_solapadas_barbero')) {
      throw new BadRequestException('El barbero ya tiene una cita en ese rango.');
    }

    if (message.includes('no_slots_solapados_barbero')) {
      throw new BadRequestException(
        'Ya tienes un horario disponible en ese rango. Ajusta el horario.',
      );
    }

    if (message.includes('minimum') || message.includes('anticipacion')) {
      throw new BadRequestException(
        'Solo puedes modificar citas con al menos 1 dia de antelacion.',
      );
    }

    throw new InternalServerErrorException(message);
  }

  private getActionClient(authorization?: string) {
    const token = authorization?.replace(/^Bearer\s+/i, '').trim();

    if (!token) {
      return supabaseAdmin;
    }

    return createSupabaseUserClient(token);
  }
}
