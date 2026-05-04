import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { supabaseAdmin } from '../supabase';
import type { CreateCitaDto } from './citas.types';

interface ClienteRow {
  id_cliente: string;
  nombre_cliente: string;
  usuario: string;
}

interface BarberoRow {
  id_barbero: string;
  nombre_barbero: string;
}

@Injectable()
export class CitasService {
  async list(role: string, profileId: string) {
    if (!profileId) {
      throw new BadRequestException('Falta el perfil');
    }

    const column = role === 'barbero' ? 'id_barbero' : 'id_cliente';
    const { data, error } = await supabaseAdmin
      .from('cita')
      .select(
        `
          id_cita,
          inicio_at,
          fin_at,
          estado,
          notas_cliente,
          cliente:cliente(nombre_cliente),
          barbero:barbero(nombre_barbero)
        `,
      )
      .eq(column, profileId)
      .order('inicio_at', { ascending: true });

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return (data || []).map((cita: any) => ({
      id: cita.id_cita,
      cliente: cita.cliente?.nombre_cliente || 'Cliente',
      barbero: cita.barbero?.nombre_barbero || 'Barbero',
      servicio: cita.notas_cliente || '',
      fecha: this.formatDate(cita.inicio_at),
      hora: this.formatHour(cita.inicio_at),
      estado: cita.estado,
    }));
  }

  async create(dto: CreateCitaDto) {
    const barbero = await this.findBarbero(dto.barbero);
    const cliente =
      dto.role === 'cliente'
        ? { id_cliente: dto.profileId }
        : await this.findCliente(dto.cliente);
    const inicioAt = this.toDate(dto.fecha, dto.hora);
    const finAt = new Date(inicioAt.getTime() + 60 * 60 * 1000);

    const { data: slot, error: slotError } = await supabaseAdmin
      .from('slot_cita')
      .insert({
        id_barbero: barbero.id_barbero,
        inicio_at: inicioAt.toISOString(),
        fin_at: finAt.toISOString(),
        estado: 'disponible',
      })
      .select('id_slot')
      .single();

    if (slotError) {
      throw new InternalServerErrorException(slotError.message);
    }

    const { data, error } = await supabaseAdmin
      .from('cita')
      .insert({
        id_cliente: cliente.id_cliente,
        id_barbero: barbero.id_barbero,
        id_slot: slot.id_slot,
        inicio_at: inicioAt.toISOString(),
        fin_at: finAt.toISOString(),
        estado: 'pendiente',
        notas_cliente: dto.servicio || null,
      })
      .select('id_cita')
      .single();

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return {
      message: 'Cita guardada',
      id: data.id_cita,
      cita: {
        id: data.id_cita,
        cliente: dto.cliente,
        barbero: dto.barbero,
        servicio: dto.servicio || '',
        fecha: dto.fecha,
        hora: dto.hora,
        estado: 'pendiente',
      },
    };
  }

  private async findBarbero(nombre: string): Promise<BarberoRow> {
    const cleanName = this.requireText(nombre, 'Selecciona un barbero');
    const { data, error } = await supabaseAdmin
      .from('barbero')
      .select('id_barbero, nombre_barbero')
      .ilike('nombre_barbero', cleanName)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    if (!data) {
      throw new BadRequestException('No se encontro el barbero seleccionado');
    }

    return data as BarberoRow;
  }

  private async findCliente(value: string): Promise<ClienteRow> {
    const cleanValue = this.requireText(value, 'Escribe el cliente');
    const { data, error } = await supabaseAdmin
      .from('cliente')
      .select('id_cliente, nombre_cliente, usuario')
      .or(
        `nombre_cliente.ilike.${cleanValue},usuario.ilike.${cleanValue},email.ilike.${cleanValue}`,
      )
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    if (!data) {
      throw new BadRequestException(
        'No se encontro el cliente. Escribe su nombre, usuario o email exacto.',
      );
    }

    return data as ClienteRow;
  }

  private toDate(fecha: string, hora: string) {
    const cleanFecha = this.requireText(fecha, 'Escribe la fecha');
    const cleanHora = this.requireText(hora, 'Selecciona la hora');
    const hourMatch = cleanHora.match(/^(\d{1,2}):00 (AM|PM)$/);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanFecha) || !hourMatch) {
      throw new BadRequestException('Fecha u hora invalida');
    }

    let hour = Number(hourMatch[1]);
    const meridian = hourMatch[2];

    if (meridian === 'PM' && hour !== 12) hour += 12;
    if (meridian === 'AM' && hour === 12) hour = 0;

    return new Date(`${cleanFecha}T${String(hour).padStart(2, '0')}:00:00-05:00`);
  }

  private formatDate(value: string) {
    return new Date(value).toISOString().slice(0, 10);
  }

  private formatHour(value: string) {
    return new Date(value).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'America/Bogota',
    });
  }

  private requireText(value: string | undefined, message: string) {
    if (!value || value.trim().length === 0) {
      throw new BadRequestException(message);
    }

    return value.trim();
  }
}
