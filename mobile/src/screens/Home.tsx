import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  SafeAreaView,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Image,
} from 'react-native';
import api from '../api';
import { colors } from '../theme';
import type { Role, SessionProfile } from '../types';

const barberOptions = [
  'Carlos Mendoza',
  'Miguel Torres',
  'Andres Restrepo',
  'Sebastian Vargas',
  'David Ospina',
];

const hourOptions = [
  '9:00 AM',
  '10:00 AM',
  '11:00 AM',
  '12:00 PM',
  '1:00 PM',
  '2:00 PM',
  '3:00 PM',
  '4:00 PM',
  '5:00 PM',
  '6:00 PM',
  '7:00 PM',
  '8:00 PM',
];

const serviceOptions = [
  'Corte clasico - Corte tradicional con tijera y maquina - 25000',
  'Degradado - Fade suave con transicion gradual - 30000',
  'Degradado alto - High fade con contraste marcado - 35000',
  'Arreglo de barba - Perfilado, definicion y aceite de barba - 20000',
  'Tintura - Coloracion completa o mechas - 60000',
  'Cejas - Diseno y depilacion de cejas - 15000',
  'Tratamiento capilar - Hidratacion y nutricion del cuero cabelludo - 45000',
];

export function HomeScreen({
  profile,
  role,
  onLogout,
}: {
  profile: SessionProfile | null;
  role: Role;
  onLogout: () => void;
}) {
  const [cliente, setCliente] = useState('');
  const [barbero, setBarbero] = useState('');
  const [servicio, setServicio] = useState('');
  const [fecha, setFecha] = useState('');
  const [hora, setHora] = useState('');
  const [citas, setCitas] = useState<any[]>([]);
  const [feedback, setFeedback] = useState('');
  const [openSelect, setOpenSelect] = useState<
    'barbero' | 'servicio' | 'hora' | null
  >(null);

  useEffect(() => {
    cargarCitas();
  }, []);

  const cargarCitas = async () => {
    if (!profile?.id) return;

    try {
      const response = await api.get('/citas', {
        params: {
          role,
          profileId: profile.id,
        },
      });
      setCitas(response.data);
    } catch {
      setFeedback('No fue posible cargar las citas');
    }
  };

  const agregarCita = async () => {
    setFeedback('');

    if (!cliente || !barbero || !fecha || !hora || (!isBarber && !servicio)) {
      setFeedback('Completa toda la informacion');
      return;
    }

    if (!profile?.id) {
      setFeedback('Sesion invalida. Vuelve a iniciar sesion');
      return;
    }

    try {
      const response = await api.post('/citas', {
        role,
        profileId: profile.id,
        cliente,
        barbero,
        servicio,
        fecha,
        hora,
      });

      if (response.data?.cita) {
        setCitas((currentCitas) => [...currentCitas, response.data.cita]);
      }

      setCliente('');
      setBarbero('');
      setServicio('');
      setFecha('');
      setHora('');
      setOpenSelect(null);

      setFeedback('Cita guardada correctamente');
    } catch (error: any) {
      const message =
        error?.response?.data?.message || 'No fue posible guardar la cita';
      setFeedback(message);
    }
  };

  const cerrarSesion = () => {
    Alert.alert('Sesion cerrada');
    onLogout();
  };

  const isBarber = role === 'barbero';
  const homeTitle = isBarber ? 'Home barbero' : 'Home cliente';
  const welcomeName = profile?.nombre || profile?.usuario || 'Usuario';

  const renderItem = ({ item }: any) => (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{item.cliente}</Text>
      <Text style={styles.cardText}>Barbero: {item.barbero}</Text>
      {item.servicio && (
        <Text style={styles.cardText}>Servicio: {item.servicio}</Text>
      )}
      <Text style={styles.cardText}>Fecha: {item.fecha}</Text>
      <Text style={styles.cardText}>Hora: {item.hora}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      <View style={styles.layout}>
        <View style={styles.sidebar}>
          <View style={styles.header}>
            <Image
              source={require('../../assets/icon.png')}
              style={styles.logo}
            />
            <Text style={styles.title}>EdgeTimer</Text>
          </View>

          <View style={styles.menu}>
            <TouchableOpacity style={[styles.menuButton, styles.activeMenuButton]}>
              <Image
                source={require('../../assets/home.png')}
                style={styles.menuIcon}
              />
              <Text style={styles.menuText}>Home</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuButton}
              onPress={cerrarSesion}
            >
              <Image
                source={require('../../assets/logout.png')}
                style={styles.menuIcon}
              />
              <Text style={styles.menuText}>Cerrar sesion</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          style={styles.mainContent}
          contentContainerStyle={styles.mainScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.pageHeader}>
            <View>
              <Text style={styles.pageTitle}>{homeTitle}</Text>
              <Text style={styles.pageSubtitle}>Hola, {welcomeName}</Text>
            </View>
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>
                {isBarber ? 'Barbero' : 'Cliente'}
              </Text>
            </View>
          </View>

          {/* Home del barbero */}
          {isBarber ? (
            <View style={styles.summaryRow}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{citas.length}</Text>
                <Text style={styles.summaryLabel}>Citas proximas</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>0</Text>
                <Text style={styles.summaryLabel}>Horarios abiertos</Text>
              </View>
            </View>
          ) : (
            <>
              {/* Home del cliente */}
              <View style={styles.summaryRow}>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryValue}>{citas.length}</Text>
                  <Text style={styles.summaryLabel}>Citas solicitadas</Text>
                </View>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryValue}>0</Text>
                  <Text style={styles.summaryLabel}>Solicitudes pendientes</Text>
                </View>
              </View>
            </>
          )}

          <Text style={styles.sectionTitle}>
            {isBarber ? 'Habilitar horario' : 'Solicitar cita'}
          </Text>

          <TextInput
            placeholder="Nombre del cliente"
            placeholderTextColor="#777"
            style={styles.input}
            value={cliente}
            onChangeText={setCliente}
          />

          <SelectField
            label="Nombre del barbero"
            value={barbero}
            options={barberOptions}
            open={openSelect === 'barbero'}
            onToggle={() =>
              setOpenSelect(openSelect === 'barbero' ? null : 'barbero')
            }
            onSelect={(nextValue) => {
              setBarbero(nextValue);
              setOpenSelect(null);
            }}
          />

          {!isBarber && (
            <SelectField
              label="Servicio"
              value={servicio}
              options={serviceOptions}
              open={openSelect === 'servicio'}
              onToggle={() =>
                setOpenSelect(openSelect === 'servicio' ? null : 'servicio')
              }
              onSelect={(nextValue) => {
                setServicio(nextValue);
                setOpenSelect(null);
              }}
            />
          )}

          <TextInput
            placeholder="Fecha (2026-05-10)"
            placeholderTextColor="#777"
            style={styles.input}
            value={fecha}
            onChangeText={setFecha}
          />

          <SelectField
            label="Hora"
            value={hora}
            options={hourOptions}
            open={openSelect === 'hora'}
            onToggle={() =>
              setOpenSelect(openSelect === 'hora' ? null : 'hora')
            }
            onSelect={(nextValue) => {
              setHora(nextValue);
              setOpenSelect(null);
            }}
          />

          <TouchableOpacity
            style={styles.addButton}
            onPress={agregarCita}
          >
            <Text style={styles.addButtonText}>
              {isBarber ? 'Guardar horario' : 'Solicitar cita'}
            </Text>
          </TouchableOpacity>

          {feedback ? <Text style={styles.feedback}>{feedback}</Text> : null}

          <Text style={styles.sectionTitle}>
            {isBarber ? 'Proximas citas' : 'Citas solicitadas'}
          </Text>

          <View style={styles.listContent}>
            {citas.length === 0 ? (
              <Text style={styles.empty}>
                {isBarber
                  ? 'No hay citas proximas'
                  : 'No hay citas disponibles'}
              </Text>
            ) : (
              citas.map((cita) => (
                <View key={cita.id}>{renderItem({ item: cita })}</View>
              ))
            )}
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function SelectField({
  label,
  value,
  options,
  open,
  onToggle,
  onSelect,
}: {
  label: string;
  value: string;
  options: string[];
  open: boolean;
  onToggle: () => void;
  onSelect: (value: string) => void;
}) {
  return (
    <View style={styles.selectWrapper}>
      <TouchableOpacity style={styles.selectButton} onPress={onToggle}>
        <Text style={[styles.selectText, !value && styles.selectPlaceholder]}>
          {value || label}
        </Text>
        <Text style={styles.selectArrow}>{open ? '^' : 'v'}</Text>
      </TouchableOpacity>

      {open && (
        <View style={styles.selectOptions}>
          {options.map((option) => (
            <TouchableOpacity
              key={option}
              style={styles.selectOption}
              onPress={() => onSelect(option)}
            >
              <Text style={styles.selectOptionText}>{option}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  layout: {
    flex: 1,
    flexDirection: 'row',
  },

  sidebar: {
    width: 240,
    backgroundColor: colors.white,
    borderRightWidth: 1,
    borderRightColor: '#E4E4E4',
    paddingHorizontal: 18,
    paddingVertical: 24,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 36,
  },

  logo: {
    width: 45,
    height: 45,
    resizeMode: 'contain',
    marginRight: 10,
  },

  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.black,
  },

  menu: {
    width: '100%',
  },

  menuButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 12,
    width: '100%',
  },

  activeMenuButton: {
    backgroundColor: colors.darkGold,
  },

  menuIcon: {
    width: 20,
    height: 20,
    resizeMode: 'contain',
    marginRight: 10,
  },

  menuText: {
    color: '#fff',
    fontWeight: 'bold',
  },

  mainContent: {
    flex: 1,
  },

  mainScrollContent: {
    paddingHorizontal: 28,
    paddingVertical: 26,
    paddingBottom: 60,
  },

  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 22,
  },

  pageTitle: {
    color: colors.black,
    fontSize: 30,
    fontWeight: 'bold',
    marginBottom: 4,
  },

  pageSubtitle: {
    color: colors.gray,
    fontSize: 17,
  },

  roleBadge: {
    backgroundColor: colors.black,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },

  roleBadgeText: {
    color: colors.lightGold,
    fontWeight: 'bold',
  },

  summaryRow: {
    flexDirection: 'row',
    marginBottom: 22,
  },

  summaryCard: {
    backgroundColor: colors.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E4E4E4',
    padding: 16,
    marginRight: 14,
    minWidth: 180,
  },

  summaryValue: {
    color: colors.black,
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },

  summaryLabel: {
    color: colors.gray,
    fontSize: 15,
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.black,
    marginBottom: 12,
    marginTop: 5,
  },

  input: {
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#ddd',
  },

  selectWrapper: {
    marginBottom: 12,
  },

  selectButton: {
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  selectText: {
    color: colors.black,
    flex: 1,
    marginRight: 10,
  },

  selectPlaceholder: {
    color: '#777',
  },

  selectArrow: {
    color: colors.darkGold,
    fontWeight: 'bold',
  },

  selectOptions: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    marginTop: 6,
    overflow: 'hidden',
  },

  selectOption: {
    paddingHorizontal: 15,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },

  selectOptionText: {
    color: colors.black,
  },

  addButton: {
    backgroundColor: colors.primary,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 20,
  },

  addButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },

  feedback: {
    color: colors.gray,
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center',
  },

  listContent: {
    flex: 1,
  },

  empty: {
    color: '#777',
    marginTop: 36,
    textAlign: 'center',
  },

  card: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#eee',
  },

  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.black,
    marginBottom: 5,
  },

  cardText: {
    color: '#555',
    fontSize: 15,
  },
});
