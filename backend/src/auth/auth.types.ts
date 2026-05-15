export type UserRole = 'cliente' | 'barbero';

export interface RegisterClientDto {
  nombre: string;
  email: string;
  telefono?: string;
  password: string;
}

export interface LoginDto {
  role: UserRole;
  email: string;
  password: string;
}

export interface AuthProfile {
  id: string;
  nombre: string;
  usuario: string;
  email?: string;
  role: UserRole;
  foto?: string | null;
  createdAt?: string;
}
