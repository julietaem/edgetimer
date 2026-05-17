import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { createSupabaseUserClient, getSignedStorageUrl, supabase } from '../supabase';
import type {
  AuthProfile,
  LoginDto,
  RegisterClientDto,
  UserRole,
} from './auth.types';

interface ClienteRow {
  id_cliente: string;
  user_id: string;
  nombre_cliente: string;
  usuario: string;
}

interface BarberoRow {
  id_barbero: string;
  user_id: string | null;
  nombre_barbero: string;
  usuario: string;
  email: string | null;
  activo: boolean;
}

@Injectable()
export class AuthService {
  async registerClient(dto: RegisterClientDto) {
    const nombre = this.requireText(dto.nombre, 'El nombre es obligatorio');
    const email = this.normalizeEmail(dto.email);
    const password = this.requirePassword(dto.password);
    const telefono = dto.telefono?.trim() || null;

    await this.ensureEmailIsFree(email);

    const { data: profile, error: createError } = await supabase.rpc(
      'register_cliente',
      {
        p_nombre: nombre,
        p_email: email,
        p_telefono: telefono,
        p_password: password,
      },
    );

    if (createError || !profile) {
      const message = createError?.message || 'No fue posible crear la cuenta';
      if (message.includes('registrado')) {
        throw new ConflictException(message);
      }

      throw new BadRequestException(message);
    }

    const createdProfile = profile as {
      id: string;
      nombre: string;
      usuario: string;
      email: string;
      role: UserRole;
    };

    return {
      message: 'Registro exitoso. Ahora puedes iniciar sesion.',
      profile: {
        id: createdProfile.id,
        nombre: createdProfile.nombre,
        usuario: createdProfile.usuario,
        email: createdProfile.email,
        role: createdProfile.role,
      },
    };
  }

  async login(dto: LoginDto) {
    const role = this.requireRole(dto.role);
    const email = this.normalizeEmail(dto.email);
    const password = this.requireText(
      dto.password,
      'La contrasena es obligatoria',
    );

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user || !data.session) {
      throw new UnauthorizedException('Usuario o contrasena incorrectos');
    }

    const profile = await this.findCurrentProfile(
      createSupabaseUserClient(data.session.access_token),
    );

    if (profile.role !== role) {
      throw new UnauthorizedException('El rol no coincide con esta cuenta');
    }

    const createdAt = data.user.created_at || profile.createdAt;

    return {
      message: 'Inicio de sesion exitoso',
      session: {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresAt: data.session.expires_at,
      },
      profile: {
        ...profile,
        createdAt,
      },
    };
  }

  private async ensureEmailIsFree(email: string) {
    const { data: barbero, error } = await supabase
      .from('barbero')
      .select('id_barbero')
      .ilike('email', email)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    if (barbero) {
      throw new ConflictException('Este email ya esta registrado');
    }
  }

  private async findCurrentProfile(
    userClient: typeof supabase,
  ): Promise<AuthProfile> {
    const { data, error } = await userClient.rpc('get_current_auth_profile');

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    if (!data) {
      throw new UnauthorizedException('No hay perfil asociado a esta cuenta');
    }

    const profileData = data as any;
    return {
      ...profileData,
      foto: await getSignedStorageUrl(profileData.foto_perfil ?? profileData.foto),
      createdAt:
        profileData.created_at ??
        profileData.createdAt ??
        profileData.fecha_registro ??
        profileData.fechaRegistro,
    } as AuthProfile;
  }

  private normalizeEmail(value: string) {
    const email = this.requireText(value, 'El email es obligatorio')
      .trim()
      .toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException('El email no es valido');
    }

    return email;
  }

  private requireRole(role: UserRole): UserRole {
    if (role !== 'cliente' && role !== 'barbero') {
      throw new BadRequestException('El rol enviado no es valido');
    }

    return role;
  }

  private requirePassword(password: string) {
    const cleanPassword = this.requireText(
      password,
      'La contrasena es obligatoria',
    );

    if (cleanPassword.length < 6) {
      throw new BadRequestException(
        'La contrasena debe tener minimo 6 caracteres',
      );
    }

    return cleanPassword;
  }

  private requireText(value: string | undefined, message: string) {
    if (!value || value.trim().length === 0) {
      throw new BadRequestException(message);
    }

    return value.trim();
  }

  private toProfile(account: ClienteRow | BarberoRow, role: UserRole): AuthProfile {
    if (role === 'cliente') {
      const cliente = account as ClienteRow;

      return {
        id: cliente.id_cliente,
        nombre: cliente.nombre_cliente,
        usuario: cliente.usuario,
        role,
      };
    }

    const barbero = account as BarberoRow;

    return {
      id: barbero.id_barbero,
      nombre: barbero.nombre_barbero,
      usuario: barbero.usuario,
      role,
    };
  }
}
