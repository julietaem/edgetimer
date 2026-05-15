import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { supabaseAdmin } from '../supabase';

export type UploadedBarberoPhotoFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
};

export type UploadedClientePhotoFile = UploadedBarberoPhotoFile;

const BARBERO_BUCKETS = [
  process.env.SUPABASE_STORAGE_BUCKET_BARBEROS || 'barberos',
  process.env.SUPABASE_STORAGE_BUCKET_BARBERO || 'barbero',
  process.env.SUPABASE_STORAGE_BUCKET_PUBLIC || 'public',
];

const CLIENTE_BUCKETS = [
  process.env.SUPABASE_STORAGE_BUCKET_CLIENTES || 'clientes',
  process.env.SUPABASE_STORAGE_BUCKET_CLIENTE || 'cliente',
  process.env.SUPABASE_STORAGE_BUCKET_PUBLIC || 'public',
];

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

  async barberoById(id: string) {
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
      .eq('id_barbero', id)
      .single();

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return {
      id: data.id_barbero,
      nombre: data.nombre_barbero,
      foto: data.foto_perfil || null,
      promedioCalificacion: Number(data.promedio_calificacion || 0),
      especialidades: (data.barbero_procedimiento || [])
        .map((item: any) => item.procedimiento)
        .filter(Boolean)
        .map((item: any) => ({
          id: item.id_procedimiento,
          nombre: item.nombre,
          precio: Number(item.precio || 0),
          duracionMinutos: item.duracion_minutos,
        })),
      horarioLaboral: 'Lunes a viernes, 8am-6pm',
    };
  }

  private async uploadToBucket(
    buckets: string[],
    fileName: string,
    file: UploadedBarberoPhotoFile,
  ) {
    let lastError: any = null;

    for (const bucket of buckets) {
      const { error: uploadError } = await supabaseAdmin.storage
        .from(bucket)
        .upload(fileName, file.buffer, {
          contentType: file.mimetype,
          upsert: true,
        });

      if (!uploadError) {
        const { data: publicData } = await supabaseAdmin.storage
          .from(bucket)
          .getPublicUrl(fileName);

        return { url: publicData.publicUrl };
      }

      lastError = uploadError;
      if (!uploadError.message?.includes('Bucket not found')) {
        break;
      }
    }

    throw new InternalServerErrorException(
      lastError?.message || 'No se pudo subir la imagen al almacenamiento.',
    );
  }

  async uploadBarberoPhoto(id: string, file: UploadedBarberoPhotoFile) {
    if (!file || !file.buffer) {
      throw new InternalServerErrorException('No se recibió ninguna imagen.');
    }

    const fileExtension = file.originalname.split('.').pop() || 'jpg';
    const fileName = `barberos/${id}-${Date.now()}.${fileExtension}`;
    const { url: photoUrl } = await this.uploadToBucket(
      BARBERO_BUCKETS,
      fileName,
      file,
    );

    const { error: updateError } = await supabaseAdmin
      .from('barbero')
      .update({ foto_perfil: photoUrl })
      .eq('id_barbero', id);

    if (updateError) {
      throw new InternalServerErrorException(updateError.message);
    }

    return { url: photoUrl };
  }

  async uploadClientePhoto(id: string, file: UploadedClientePhotoFile) {
    if (!file || !file.buffer) {
      throw new InternalServerErrorException('No se recibió ninguna imagen.');
    }

    const fileExtension = file.originalname.split('.').pop() || 'jpg';
    const fileName = `clientes/${id}-${Date.now()}.${fileExtension}`;
    const { url: photoUrl } = await this.uploadToBucket(
      CLIENTE_BUCKETS,
      fileName,
      file,
    );

    const { error: updateError } = await supabaseAdmin
      .from('cliente')
      .update({ foto_perfil: photoUrl })
      .eq('id_cliente', id);

    if (updateError) {
      throw new InternalServerErrorException(updateError.message);
    }

    return { url: photoUrl };
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
