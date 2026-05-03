export type Role = 'cliente' | 'barbero';
export type Screen = 'role' | 'login' | 'register' | 'home';

export interface SessionProfile {
  id: string;
  nombre: string;
  usuario: string;
  role: Role;
}
