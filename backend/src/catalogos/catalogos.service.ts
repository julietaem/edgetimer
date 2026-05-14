import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { supabaseAdmin } from '../supabase';

@Injectable()
export class CatalogosService {
  async barberos() {
    const { data, error } = await supabaseAdmin
      .from('barbero')
      .select(
        `
          id_barbero,
          nombre_barbero,
          foto_perfil,
          promedio_calificacion,
          activo,
          barbero_procedimiento(
            procedimiento:procedimiento(id_procedimiento, nombre, precio, duracion_minutos)
          )
        `,
      )
      .eq('activo', true)
      .order('nombre_barbero', { ascending: true });

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return (data || []).map((barbero: any) => ({
      id: barbero.id_barbero,
      nombre: barbero.nombre_barbero,
      foto: barbero.foto_perfil || null,
      promedioCalificacion: Number(barbero.promedio_calificacion || 0),
      especialidades: (barbero.barbero_procedimiento || [])
        .map((item: any) => item.procedimiento)
        .filter(Boolean)
        .map((item: any) => ({
          id: item.id_procedimiento,
          nombre: item.nombre,
          precio: Number(item.precio || 0),
          duracionMinutos: item.duracion_minutos,
        })),
      horarioLaboral: 'Lunes a viernes, 8am-6pm',
    }));
  }

  async procedimientos() {
    const { data, error } = await supabaseAdmin
      .from('procedimiento')
      .select('id_procedimiento, nombre, descripcion, precio, duracion_minutos')
      .eq('activo', true)
      .order('nombre', { ascending: true });

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return (data || []).map((item: any) => ({
      id: item.id_procedimiento,
      nombre: item.nombre,
      descripcion: item.descripcion || '',
      precio: Number(item.precio || 0),
      duracionMinutos: item.duracion_minutos,
    }));
  }
}
