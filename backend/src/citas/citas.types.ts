import type { UserRole } from '../auth/auth.types';

export interface CreateCitaDto {
  role: UserRole;
  profileId: string;
  cliente: string;
  barbero: string;
  servicio?: string;
  fecha: string;
  hora: string;
}

