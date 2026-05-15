import { useEffect, useState, type ReactNode } from 'react';
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import api from '../api';
import { colors, fonts } from '../theme';
import type { Barbero, Role, SessionProfile } from '../types';

const avatar = require('../../assets/user.png');

export function PerfilScreen({
  profile,
  role,
  barberoId,
  onBack,
}: {
  profile: SessionProfile | null;
  role: Role;
  barberoId?: string;
  onBack: () => void;
}) {
  const isBarber = role === 'barbero';
  const { width } = useWindowDimensions();
  const isCompact = width < 620;
  const [barbero, setBarbero] = useState<Barbero | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState('');

  const loadBarbero = async () => {
    if (!barberoId) return;
    setLoading(true);
    setBarbero(null); // Reset antes de cargar
    try {
      const res = await api.get(`/catalogos/barberos/${barberoId}`);
      setBarbero(res.data);
    } catch (error: any) {
      setToast(error?.response?.data?.message || 'No fue posible cargar el perfil del barbero.');
      setBarbero(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (barberoId && barberoId.length > 0) {
      loadBarbero();
    } else {
      setBarbero(null);
    }
  }, [barberoId]);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(''), 3500);
  };

  const createFormData = async (uri: string, name: string, type: string) => {
    const formData = new FormData();

    if (Platform.OS === 'web') {
      const response = await fetch(uri);
      const blob = await response.blob();
      const file = new File([blob], name, { type });
      formData.append('photo', file);
      return formData;
    }

    formData.append('photo', { uri, name, type } as any);
    return formData;
  };

  const uploadPhoto = async (uri: string) => {
    if (!profile?.id) {
      showToast('No se encontró el perfil.');
      return;
    }

    setUploading(true);
    try {
      const fileName = uri.split('/').pop() || `perfil-${Date.now()}.jpg`;
      const match = /\.(\w+)$/.exec(fileName);
      const type = match ? `image/${match[1]}` : 'image/jpeg';
      const body = await createFormData(uri, fileName, type);
      const endpoint =
        role === 'barbero'
          ? `/catalogos/barberos/${profile.id}/foto`
          : `/catalogos/clientes/${profile.id}/foto`;

      await api.post(endpoint, body);

      showToast('Foto subida correctamente.');
      if (barberoId) {
        await loadBarbero();
      }
    } catch (error: any) {
      showToast(
        error?.response?.data?.message || error?.message || 'Error al subir la foto.',
      );
    } finally {
      setUploading(false);
    }
  };

  const formatRegistrationDate = (date?: string) => {
    if (!date) return 'No disponible';
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return date;
    return parsed.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const pickImage = async () => {
    if (Platform.OS !== 'web') {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showToast('Necesitamos permiso para acceder a las fotos.');
        return;
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (result.canceled || result.assets.length === 0) {
      return;
    }

    const asset = result.assets[0];
    if (asset.uri) {
      await uploadPhoto(asset.uri);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, isCompact && styles.headerCompact]}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>← Atrás</Text>
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.kicker}>{barberoId ? 'Perfil de Barbero' : 'Mi Perfil'}</Text>
          <Text style={styles.title}>{barberoId ? barbero?.nombre || 'Cargando...' : profile?.nombre || 'Tu Perfil'}</Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {barberoId && loading ? (
          <Text style={styles.empty}>Cargando perfil de barbero...</Text>
        ) : barberoId && !barbero ? (
          <Text style={styles.empty}>No se pudo cargar el perfil del barbero.</Text>
        ) : barberoId && barbero ? (
          <BarberPerfilContent
            barbero={barbero}
            isCompact={isCompact}
            canUpload={barberoId === profile?.id && role === 'barbero'}
            onUploadPhoto={pickImage}
            uploading={uploading}
          />
        ) : isBarber ? (
          <BarberOwnProfile
            profile={profile}
            isCompact={isCompact}
            onUploadPhoto={pickImage}
            uploading={uploading}
            formatRegistrationDate={formatRegistrationDate}
          />
        ) : (
          <ClientProfile
            profile={profile}
            isCompact={isCompact}
            onUploadPhoto={pickImage}
            uploading={uploading}
            formatRegistrationDate={formatRegistrationDate}
          />
        )}
      </ScrollView>

      {toast ? <Text style={styles.toast}>{toast}</Text> : null}
    </View>
  );
}

function BarberPerfilContent({
  barbero,
  isCompact,
  canUpload,
  onUploadPhoto,
  uploading,
}: {
  barbero: Barbero;
  isCompact: boolean;
  canUpload: boolean;
  onUploadPhoto: () => void;
  uploading: boolean;
}) {
  return (
    <View>
      <View style={[styles.profileCard, isCompact && styles.fullWidthCard]}>
        <Avatar source={barbero.foto} size={120} />
        <Text style={styles.name}>{barbero.nombre}</Text>
        <Text style={styles.rating}>★ {barbero.promedioCalificacion.toFixed(1)}</Text>
        {canUpload ? (
          <Pressable
            style={[styles.uploadButton, uploading && styles.disabled]}
            onPress={onUploadPhoto}
            disabled={uploading}
          >
            <Text style={styles.uploadButtonText}>
              {uploading ? 'Subiendo...' : 'Actualizar foto'}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <SectionTitle title="Información" />
      <InfoBox label="Horario Laboral" value={barbero.horarioLaboral} />

      <SectionTitle title="Especialidades" />
      <View style={styles.grid}>
        {barbero.especialidades.length === 0 ? (
          <Text style={styles.empty}>Sin especialidades registradas.</Text>
        ) : (
          barbero.especialidades.map((service) => (
            <View key={service.id} style={[styles.serviceCard, isCompact && styles.fullWidthCard]}>
              <Text style={styles.cardTitle}>{service.nombre}</Text>
              <Text style={styles.cardText}>{service.descripcion || 'Servicio disponible'}</Text>
              <Text style={styles.price}>${service.precio.toLocaleString()}</Text>
              <Text style={styles.duration}>{service.duracionMinutos} min</Text>
            </View>
          ))
        )}
      </View>
    </View>
  );
}

function BarberOwnProfile({
  profile,
  isCompact,
  onUploadPhoto,
  uploading,
  formatRegistrationDate,
}: {
  profile: SessionProfile | null;
  isCompact: boolean;
  onUploadPhoto: () => void;
  uploading: boolean;
  formatRegistrationDate: (date?: string) => string;
}) {
  return (
    <View>
      <View style={[styles.profileCard, isCompact && styles.fullWidthCard]}>
        <Avatar source={profile?.foto || null} size={120} />
        <Text style={styles.name}>{profile?.nombre || 'Tu nombre'}</Text>
        <Text style={styles.role}>Barbero</Text>
        <Pressable
          style={[styles.uploadButton, uploading && styles.disabled]}
          onPress={onUploadPhoto}
          disabled={uploading}
        >
          <Text style={styles.uploadButtonText}>
            {uploading ? 'Subiendo...' : 'Actualizar foto'}
          </Text>
        </Pressable>
      </View>

      <SectionTitle title="Información de cuenta" />
      <InfoBox label="Usuario" value={profile?.usuario || 'No disponible'} />
      <InfoBox
        label="Registrado desde"
        value={formatRegistrationDate(
          profile?.createdAt ||
            (profile as any)?.created_at ||
            (profile as any)?.fecha_registro ||
            (profile as any)?.fechaRegistro,
        )}
      />
    </View>
  );
}

function ClientProfile({
  profile,
  isCompact,
  onUploadPhoto,
  uploading,
  formatRegistrationDate,
}: {
  profile: SessionProfile | null;
  isCompact: boolean;
  onUploadPhoto: () => void;
  uploading: boolean;
  formatRegistrationDate: (date?: string) => string;
}) {
  return (
    <View>
      <View style={[styles.profileCard, isCompact && styles.fullWidthCard]}>
        <Avatar source={profile?.foto || null} size={120} />
        <Text style={styles.name}>{profile?.nombre || 'Tu nombre'}</Text>
        <Text style={styles.role}>Cliente</Text>
        <Pressable
          style={[styles.uploadButton, uploading && styles.disabled]}
          onPress={onUploadPhoto}
          disabled={uploading}
        >
          <Text style={styles.uploadButtonText}>
            {uploading ? 'Subiendo...' : 'Actualizar foto'}
          </Text>
        </Pressable>
      </View>

      <SectionTitle title="Información de Cuenta" />
      <InfoBox label="Usuario" value={profile?.usuario || 'No disponible'} />
      <InfoBox
        label="Registrado desde"
        value={formatRegistrationDate(
          profile?.createdAt ||
            (profile as any)?.created_at ||
            (profile as any)?.fecha_registro ||
            (profile as any)?.fechaRegistro,
        )}
      />
    </View>
  );
}

function Avatar({ source, size }: { source: string | null; size: number }) {
  return (
    <Image
      source={source ? { uri: source } : avatar}
      style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}
    />
  );
}

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoBox}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 18,
  },
  headerCompact: {
    alignItems: 'flex-start',
    gap: 10,
  },
  backButton: {
    padding: 8,
    marginRight: 4,
  },
  backText: {
    color: colors.darkGold,
    fontFamily: fonts.title,
    fontSize: 16,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  kicker: {
    color: colors.darkGold,
    fontFamily: fonts.medium,
    fontSize: 18,
  },
  title: {
    color: colors.black,
    fontFamily: fonts.title,
    fontSize: 28,
  },
  content: {
    flex: 1,
  },
  profileCard: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
    minWidth: 240,
    padding: 24,
    flexGrow: 1,
    flexBasis: 280,
    marginBottom: 24,
  },
  fullWidthCard: {
    width: '100%',
    minWidth: '100%',
    flexBasis: '100%',
  },
  avatar: {
    backgroundColor: colors.softGold,
    resizeMode: 'cover',
  },
  name: {
    color: colors.black,
    fontFamily: fonts.title,
    fontSize: 26,
    textAlign: 'center',
  },
  uploadButton: {
    backgroundColor: colors.gold,
    borderRadius: 8,
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  disabled: {
    opacity: 0.45,
  },
  uploadButtonText: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 16,
  },
  role: {
    color: colors.gray,
    fontFamily: fonts.medium,
    fontSize: 18,
  },
  rating: {
    color: colors.darkGold,
    fontFamily: fonts.title,
    fontSize: 20,
  },
  sectionTitle: {
    color: colors.black,
    fontFamily: fonts.title,
    fontSize: 22,
    marginBottom: 12,
    marginTop: 16,
  },
  infoBox: {
    backgroundColor: colors.background,
    borderRadius: 8,
    marginBottom: 10,
    padding: 12,
  },
  infoLabel: {
    color: colors.muted,
    fontFamily: fonts.medium,
    fontSize: 14,
    marginBottom: 4,
  },
  infoValue: {
    color: colors.black,
    fontFamily: fonts.title,
    fontSize: 18,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginBottom: 20,
  },
  serviceCard: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
    minWidth: 200,
    padding: 14,
    flexGrow: 1,
    flexBasis: 200,
  },
  cardTitle: {
    color: colors.black,
    fontFamily: fonts.title,
    fontSize: 18,
  },
  cardText: {
    color: colors.gray,
    fontFamily: fonts.medium,
    fontSize: 14,
  },
  price: {
    color: colors.darkGold,
    fontFamily: fonts.title,
    fontSize: 18,
    marginTop: 4,
  },
  duration: {
    color: colors.muted,
    fontFamily: fonts.medium,
    fontSize: 14,
  },
  empty: {
    color: colors.gray,
    fontFamily: fonts.medium,
    fontSize: 18,
    marginBottom: 20,
  },
  toast: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: colors.black,
    color: colors.white,
    fontFamily: fonts.medium,
    fontSize: 16,
    padding: 12,
    borderRadius: 8,
    textAlign: 'center',
  },
});
