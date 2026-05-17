import type { UserRole } from '../auth/auth.types';

export type EstadoCita =
  | 'pendiente'
  | 'confirmada'
  | 'realizada'
  | 'cancelada'
  | 'rechazada';

export interface ListCitasQuery {
  role: UserRole;
  profileId: string;
  view?: 'home' | 'agenda';
  estado?: EstadoCita;
}

export interface CreateSolicitudDto {
  profileId: string;
  idBarbero: string;
  procedimientoIds: string[];
  fecha: string;
  horaInicio: string;
  notas?: string;
}

export interface ReserveSlotDto {
  profileId: string;
  slotId: string;
  procedimientoIds: string[];
  notas?: string;
}

export interface CreateSlotDto {
  profileId: string;
  fecha: string;
  horaInicio: string;
  horaFin?: string;
}

export interface UpdateSlotDto {
  profileId: string;
  fecha: string;
  horaInicio: string;
  horaFin?: string;
}

export interface CitaActionDto {
  role: UserRole;
  profileId: string;
}

export interface ReprogramCitaDto extends CitaActionDto {
  fecha: string;
  horaInicio: string;
  horaFin: string;
}

export interface CalificarCitaDto {
  profileId: string;
  puntuacion: number;
  resena?: string;
}
