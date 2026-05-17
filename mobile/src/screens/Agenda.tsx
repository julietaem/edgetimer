import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import api from '../api';
import { colors, fonts } from '../theme';
import type { Cita, Role, SessionProfile, SlotDisponible } from '../types';
import { addMinutesToTime, buildHourOptions, formatMoney, formatShortDate, isSameDay, todayInputValue } from '../utils/format';

type TabKey = 'proximas' | 'solicitudes' | 'pasadas' | 'calendario';

const hourOptions = buildHourOptions();

export function AgendaScreen({
  profile,
  role,
}: {
  profile: SessionProfile | null;
  role: Role;
}) {
  const isBarber = role === 'barbero';
  const { width } = useWindowDimensions();
  const showCalendarTab = Platform.OS !== 'web' || width < 900;
  const [citas, setCitas] = useState<Cita[]>([]);
  const [slots, setSlots] = useState<SlotDisponible[]>([]);
  const [tab, setTab] = useState<TabKey>('proximas');
  const [selectedDate, setSelectedDate] = useState(todayInputValue());
  const [toast, setToast] = useState('');
  const [reprogramCita, setReprogramCita] = useState<Cita | null>(null);
  const [ratingCita, setRatingCita] = useState<Cita | null>(null);

  const loadData = async () => {
    if (!profile?.id) return;

    try {
      const [citasRes, slotsRes] = await Promise.all([
        api.get('/citas', { params: { role, profileId: profile.id } }),
        api.get('/slots', { params: isBarber ? { profileId: profile.id } : {} }),
      ]);
      setCitas(citasRes.data);
      setSlots(slotsRes.data);
    } catch (error: any) {
      setToast(error?.response?.data?.message || 'No fue posible cargar la Agenda.');
    }
  };

  useEffect(() => {
    loadData();
  }, [profile?.id, role]);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(''), 3500);
  };

  const runAction = async (action: () => Promise<any>, fallback: string) => {
    try {
      const response = await action();
      showToast(response.data?.message || fallback);
      await loadData();
    } catch (error: any) {
      showToast(error?.response?.data?.message || fallback);
    }
  };

  const filtered = useMemo(() => {
    const now = Date.now();
    if (tab === 'proximas') {
      return citas.filter(
        (cita) =>
          cita.estado === 'confirmada' &&
          new Date(cita.finAt).getTime() >= now,
      );
    }
    if (tab === 'solicitudes') {
      return citas.filter((cita) => ['pendiente', 'rechazada', 'cancelada'].includes(cita.estado));
    }
    if (tab === 'calendario') {
      return [];
    }
    return citas
      .filter((cita) => cita.estado === 'realizada')
      .sort((a, b) => new Date(b.inicioAt).getTime() - new Date(a.inicioAt).getTime());
  }, [citas, tab]);

  const dayCitas = citas.filter((cita) => isSameDay(cita.inicioAt, selectedDate));
  const daySlots = slots.filter((slot) => slot.fecha === selectedDate);
  const calendarPanel = (
    <CalendarPanel
      citas={citas}
      dayCitas={dayCitas}
      daySlots={daySlots}
      isBarber={isBarber}
      selectedDate={selectedDate}
      slots={isBarber ? slots : []}
      onSelectDate={setSelectedDate}
    />
  );

  return (
    <View>
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>{isBarber ? 'Agenda barbero' : 'Agenda cliente'}</Text>
          <Text style={styles.title}>Citas y calendario</Text>
        </View>
      </View>

      <View style={styles.tabs}>
        <TabButton active={tab === 'proximas'} label="Proximas" onPress={() => setTab('proximas')} />
        <TabButton
          active={tab === 'solicitudes'}
          label={isBarber ? 'Solicitudes' : 'Solicitadas'}
          onPress={() => setTab('solicitudes')}
        />
        <TabButton active={tab === 'pasadas'} label="Pasadas" onPress={() => setTab('pasadas')} />
        {showCalendarTab ? (
          <TabButton
            active={tab === 'calendario'}
            label="Calendario"
            onPress={() => setTab('calendario')}
          />
        ) : null}
      </View>

      <View style={styles.contentGrid}>
        <View style={[styles.listColumn, showCalendarTab && tab === 'calendario' && styles.hidden]}>
          {filtered.length === 0 ? (
            <Text style={styles.empty}>No hay citas para esta pestana.</Text>
          ) : (
            filtered.map((cita) => (
              <AgendaCard
                key={cita.id}
                cita={cita}
                isBarber={isBarber}
                onAccept={() =>
                  runAction(
                    () => api.patch(`/citas/${cita.id}/aceptar`, { role, profileId: profile?.id }),
                    'Solicitud aceptada.',
                  )
                }
                onReject={() =>
                  runAction(
                    () => api.patch(`/citas/${cita.id}/rechazar`, { role, profileId: profile?.id }),
                    'Solicitud rechazada.',
                  )
                }
                onCancel={() =>
                  runAction(
                    () => api.patch(`/citas/${cita.id}/cancelar`, { role, profileId: profile?.id }),
                    'Cita cancelada.',
                  )
                }
                onRate={() => setRatingCita(cita)}
                onReprogram={() => setReprogramCita(cita)}
              />
            ))
          )}
        </View>

        <View
          style={[
            styles.calendarColumn,
            showCalendarTab && styles.fullColumn,
            showCalendarTab && tab !== 'calendario' && styles.hidden,
          ]}
        >
          <Calendar
            citas={citas}
            selectedDate={selectedDate}
            slots={isBarber ? slots : []}
            onSelect={setSelectedDate}
          />
          <View style={styles.dayPanel}>
            <Text style={styles.panelTitle}>{formatShortDate(selectedDate)}</Text>
            {daySlots.map((slot) => (
              <View key={slot.id} style={styles.dayItem}>
                <Text style={styles.itemTitle}>Horario pendiente</Text>
                <Text style={styles.itemText}>
                  {slot.barbero.nombre} - {slot.horaInicio} - {slot.horaFin}
                </Text>
              </View>
            ))}
            {dayCitas.map((cita) => (
              <View key={cita.id} style={styles.dayItem}>
                <Text style={styles.itemTitle}>
                  {isBarber ? cita.cliente.nombre : cita.barbero.nombre}
                </Text>
                <Text style={styles.itemText}>
                  {cita.horaInicio} - {cita.horaFin} - {cita.estadoLabel}
                </Text>
              </View>
            ))}
            {dayCitas.length === 0 && daySlots.length === 0 ? (
              <Text style={styles.empty}>Sin citas ni horarios en este día.</Text>
            ) : null}
          </View>
        </View>
      </View>

      <ReprogramModal
        cita={reprogramCita}
        open={!!reprogramCita}
        onClose={() => setReprogramCita(null)}
        onSubmit={(payload) =>
          runAction(
            () =>
              api.patch(`/citas/${reprogramCita?.id}/reprogramar`, {
                role,
                profileId: profile?.id,
                ...payload,
              }),
            'Cita reprogramada.',
          ).then(() => setReprogramCita(null))
        }
      />

      <RatingModal
        cita={ratingCita}
        open={!!ratingCita}
        onClose={() => setRatingCita(null)}
        onSubmit={(payload) =>
          runAction(
            () =>
              api.post(`/citas/${ratingCita?.id}/calificar`, {
                profileId: profile?.id,
                ...payload,
              }),
            'Calificación guardada.',
          ).then(() => setRatingCita(null))
        }
      />

      {toast ? <Text style={styles.toast}>{toast}</Text> : null}
    </View>
  );
}

function AgendaCard({
  cita,
  isBarber,
  onAccept,
  onCancel,
  onRate,
  onReject,
  onReprogram,
}: {
  cita: Cita;
  isBarber: boolean;
  onAccept: () => void;
  onCancel: () => void;
  onRate: () => void;
  onReject: () => void;
  onReprogram: () => void;
}) {
  const name = isBarber ? cita.cliente.nombre : cita.barbero.nombre;
  const isRequest = cita.estado === 'pendiente';
  const isPast = cita.estado === 'realizada';
  const isClosed = cita.estado === 'rechazada' || cita.estado === 'cancelada';
  const disabled = !cita.puedeModificar;

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{name}</Text>
      <Text style={styles.cardText}>{cita.procedimientos.map((item) => item.nombre).join(', ')}</Text>
      <Text style={styles.cardText}>{formatMoney(cita.costoTotal)}</Text>
      <Text style={styles.cardText}>
        {formatShortDate(cita.fecha)} - {cita.horaInicio} - {cita.horaFin}
      </Text>
      <Text style={styles.status}>{cita.estadoLabel}</Text>

      {isPast ? (
        <View style={styles.pastBox}>
          {cita.calificacion ? (
            <Text style={styles.cardText}>
              Calificación: {cita.calificacion.puntuacion}/5 {cita.calificacion.resena}
            </Text>
          ) : !isBarber && cita.estado === 'realizada' ? (
            <Pressable style={styles.smallButton} onPress={onRate}>
              <Text style={styles.smallButtonText}>Calificar esta cita</Text>
            </Pressable>
          ) : isBarber && cita.estado === 'realizada' ? (
            <Text style={styles.cardText}>Sin calificación recibida.</Text>
          ) : (
            <Text style={styles.cardText}>Cita pendiente de cierre.</Text>
          )}
        </View>
      ) : isClosed ? (
        <View style={styles.pastBox}>
          <Text style={styles.cardText}>
            {cita.estado === 'rechazada'
              ? 'Esta solicitud fue rechazada.'
              : 'Esta cita fue cancelada.'}
          </Text>
        </View>
      ) : (
        <View style={styles.actions}>
          {isRequest && isBarber ? (
            <>
              <Pressable style={styles.smallButton} onPress={onAccept}>
                <Text style={styles.smallButtonText}>Aceptar</Text>
              </Pressable>
              <Pressable style={styles.ghostButton} onPress={onReject}>
                <Text style={styles.ghostButtonText}>Rechazar</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Pressable
                disabled={disabled}
                style={[styles.smallButton, disabled && styles.disabled]}
                onPress={onReprogram}
              >
                <Text style={styles.smallButtonText}>Reprogramar</Text>
              </Pressable>
              <Pressable
                disabled={disabled}
                style={[styles.ghostButton, disabled && styles.disabled]}
                onPress={onCancel}
              >
                <Text style={styles.ghostButtonText}>Cancelar</Text>
              </Pressable>
            </>
          )}
        </View>
      )}
      {disabled && !isPast && !isRequest ? (
        <Text style={styles.helpText}>Solo puedes modificar citas con al menos 1 día de antelación</Text>
      ) : null}
    </View>
  );
}

function CalendarPanel({
  citas,
  dayCitas,
  daySlots,
  isBarber,
  selectedDate,
  slots,
  onSelectDate,
}: {
  citas: Cita[];
  dayCitas: Cita[];
  daySlots: SlotDisponible[];
  isBarber: boolean;
  selectedDate: string;
  slots: SlotDisponible[];
  onSelectDate: (date: string) => void;
}) {
  return (
    <>
      <Calendar
        citas={citas}
        selectedDate={selectedDate}
        slots={slots}
        onSelect={onSelectDate}
      />
      <View style={styles.dayPanel}>
        <Text style={styles.panelTitle}>{formatShortDate(selectedDate)}</Text>
        {daySlots.map((slot) => (
          <View key={slot.id} style={styles.dayItem}>
            <Text style={styles.itemTitle}>Horario pendiente</Text>
            <Text style={styles.itemText}>
              {slot.barbero.nombre} - {slot.horaInicio} - {slot.horaFin}
            </Text>
          </View>
        ))}
        {dayCitas.map((cita) => (
          <View key={cita.id} style={styles.dayItem}>
            <Text style={styles.itemTitle}>
              {isBarber ? cita.cliente.nombre : cita.barbero.nombre}
            </Text>
            <Text style={styles.itemText}>
              {cita.horaInicio} - {cita.horaFin} - {cita.estadoLabel}
            </Text>
          </View>
        ))}
        {dayCitas.length === 0 && daySlots.length === 0 ? (
          <Text style={styles.empty}>Sin citas ni horarios en este día.</Text>
        ) : null}
      </View>
    </>
  );
}

function Calendar({
  citas,
  selectedDate,
  slots,
  onSelect,
}: {
  citas: Cita[];
  selectedDate: string;
  slots: SlotDisponible[];
  onSelect: (date: string) => void;
}) {
  const days = useMemo(() => buildMonthDays(selectedDate), [selectedDate]);

  return (
    <View style={styles.calendar}>
      <Text style={styles.panelTitle}>Calendario mensual</Text>
      <View style={styles.calendarGrid}>
        {days.map((date) => {
          const dateKey = date.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
          const hasUpcoming = citas.some(
            (cita) =>
              isSameDay(cita.inicioAt, dateKey) &&
              ['pendiente', 'confirmada'].includes(cita.estado),
          );
          const hasPast = citas.some(
            (cita) =>
              isSameDay(cita.inicioAt, dateKey) &&
              cita.estado === 'realizada',
          );
          const hasSlot = slots.some((slot) => slot.fecha === dateKey);
          const selected = dateKey === selectedDate;

          return (
            <Pressable
              key={dateKey}
              style={[
                styles.dayCell,
                hasSlot && styles.daySlot,
                hasPast && styles.dayPast,
                hasUpcoming && styles.dayUpcoming,
                selected && styles.daySelected,
              ]}
              onPress={() => onSelect(dateKey)}
            >
              <Text style={[styles.dayText, selected && styles.dayTextSelected]}>
                {date.getDate()}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function ReprogramModal({
  cita,
  open,
  onClose,
  onSubmit,
}: {
  cita: Cita | null;
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: { fecha: string; horaInicio: string; horaFin: string }) => Promise<void>;
}) {
  const [fecha, setFecha] = useState(cita?.fecha || todayInputValue());
  const [horaInicio, setHoraInicio] = useState(cita?.horaInicio || '09:00');
  const [error, setError] = useState('');
  const duracion = useMemo(
    () =>
      cita?.procedimientos.reduce(
        (total, procedimiento) => total + procedimiento.duracionMinutos,
        0,
      ) || 0,
    [cita],
  );
  const horaFin = duracion > 0 ? addMinutesToTime(horaInicio, duracion) : '';
  const validStartOptions = useMemo(
    () =>
      hourOptions.filter((hour) => {
        const end = addMinutesToTime(hour, duracion);
        return !!end && end <= '18:00';
      }),
    [duracion],
  );

  useEffect(() => {
    if (cita) {
      setFecha(cita.fecha);
      setHoraInicio(cita.horaInicio);
    }
  }, [cita]);

  const submit = async () => {
    if (!fecha || !horaInicio || !horaFin) {
      setError('Todos los campos son obligatorios.');
      return;
    }
    if (horaFin > '18:00') {
      setError('La cita debe terminar antes de las 18:00.');
      return;
    }
    setError('');
    await onSubmit({ fecha, horaInicio, horaFin });
  };

  return (
    <FormModal open={open} title="Reprogramar cita" submitLabel="Guardar" onClose={onClose} onSubmit={submit}>
      <DateInput value={fecha} onChange={setFecha} />
      <HourPills
        label="Hora de inicio"
        options={validStartOptions}
        value={horaInicio}
        onChange={setHoraInicio}
      />
      {horaFin ? (
        <Text style={styles.cardText}>
          Duracion: {duracion} min - {horaInicio} - {horaFin}
        </Text>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </FormModal>
  );
}

function RatingModal({
  cita,
  open,
  onClose,
  onSubmit,
}: {
  cita: Cita | null;
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: { puntuacion: number; resena: string }) => Promise<void>;
}) {
  const [puntuacion, setPuntuacion] = useState(5);
  const [resena, setResena] = useState('');

  return (
    <FormModal open={open} title="Calificar cita" submitLabel="Guardar" onClose={onClose} onSubmit={() => onSubmit({ puntuacion, resena })}>
      <Text style={styles.cardText}>{cita ? cita.barbero.nombre : ''}</Text>
      <View style={styles.ratingRow}>
        {[1, 2, 3, 4, 5].map((value) => (
          <Pressable
            key={value}
            style={[styles.ratingButton, puntuacion === value && styles.ratingSelected]}
            onPress={() => setPuntuacion(value)}
          >
            <Text style={[styles.ratingText, puntuacion === value && styles.ratingTextSelected]}>
              {value}
            </Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        multiline
        placeholder="Resena"
        placeholderTextColor={colors.muted}
        style={[styles.input, styles.textArea]}
        value={resena}
        onChangeText={setResena}
      />
    </FormModal>
  );
}

function FormModal({
  children,
  open,
  title,
  submitLabel,
  onClose,
  onSubmit,
}: {
  children: ReactNode;
  open: boolean;
  title: string;
  submitLabel: string;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <Modal animationType="fade" transparent visible={open} onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{title}</Text>
          <ScrollView
            contentContainerStyle={styles.modalScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
          <View style={styles.modalActions}>
            <Pressable style={styles.secondaryAction} onPress={onClose}>
              <Text style={styles.secondaryActionText}>Cancelar</Text>
            </Pressable>
            <Pressable style={styles.modalSubmit} onPress={onSubmit}>
              <Text style={styles.modalSubmitText}>{submitLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function DateInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>Fecha</Text>
      <TextInput
        placeholder="YYYY-MM-DD"
        placeholderTextColor={colors.muted}
        style={styles.input}
        value={value}
        onChangeText={onChange}
      />
    </View>
  );
}

function HourPills({
  label,
  options = hourOptions,
  value,
  onChange,
}: {
  label: string;
  options?: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.pillWrap}>
        {options.map((hour) => (
          <Pressable
            key={hour}
            style={[styles.pill, value === hour && styles.pillSelected]}
            onPress={() => onChange(hour)}
          >
            <Text style={[styles.pillText, value === hour && styles.pillTextSelected]}>
              {hour}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function TabButton({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.tab, active && styles.tabActive]} onPress={onPress}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

function buildMonthDays(dateValue: string) {
  const base = new Date(`${dateValue}T12:00:00-05:00`);
  const year = base.getFullYear();
  const month = base.getMonth();
  const count = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: count }, (_, index) => new Date(year, month, index + 1, 12));
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  kicker: {
    color: colors.darkGold,
    fontFamily: fonts.medium,
    fontSize: 21,
  },
  title: {
    color: colors.black,
    fontFamily: fonts.title,
    fontSize: 36,
  },
  tabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 18,
  },
  tab: {
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  tabActive: {
    backgroundColor: colors.black,
    borderColor: colors.black,
  },
  tabText: {
    color: colors.gray,
    fontFamily: fonts.medium,
    fontSize: 18,
  },
  tabTextActive: {
    color: colors.white,
  },
  contentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 18,
  },
  listColumn: {
    flex: 2,
    gap: 12,
    minWidth: 300,
  },
  calendarColumn: {
    flex: 1,
    gap: 14,
    minWidth: 290,
  },
  fullColumn: {
    flex: 1,
    minWidth: '100%',
    width: '100%',
  },
  hidden: {
    display: 'none',
  },
  card: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
  },
  cardTitle: {
    color: colors.black,
    fontFamily: fonts.title,
    fontSize: 22,
  },
  cardText: {
    color: colors.gray,
    fontFamily: fonts.medium,
    fontSize: 18,
  },
  status: {
    alignSelf: 'flex-start',
    backgroundColor: colors.softGold,
    borderRadius: 8,
    color: colors.darkGold,
    fontFamily: fonts.medium,
    fontSize: 18,
    marginTop: 8,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  smallButton: {
    alignSelf: 'flex-start',
    backgroundColor: colors.black,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  smallButtonText: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 16,
  },
  ghostButton: {
    alignSelf: 'flex-start',
    borderColor: colors.gold,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  ghostButtonText: {
    color: colors.darkGold,
    fontFamily: fonts.title,
    fontSize: 16,
  },
  disabled: {
    opacity: 0.45,
  },
  helpText: {
    color: colors.muted,
    fontFamily: fonts.medium,
    fontSize: 16,
    marginTop: 8,
  },
  pastBox: {
    marginTop: 12,
  },
  calendar: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  dayCell: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  dayUpcoming: {
    backgroundColor: '#EAF7EE',
    borderColor: colors.success,
  },
  dayPast: {
    backgroundColor: '#ECECEC',
  },
  daySlot: {
    backgroundColor: colors.softGold,
  },
  daySelected: {
    backgroundColor: colors.black,
    borderColor: colors.black,
  },
  dayText: {
    color: colors.gray,
    fontFamily: fonts.medium,
    fontSize: 17,
  },
  dayTextSelected: {
    color: colors.white,
  },
  dayPanel: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
  },
  panelTitle: {
    color: colors.black,
    fontFamily: fonts.title,
    fontSize: 22,
    marginBottom: 10,
  },
  dayItem: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    paddingVertical: 10,
  },
  itemTitle: {
    color: colors.black,
    fontFamily: fonts.title,
    fontSize: 19,
  },
  itemText: {
    color: colors.gray,
    fontFamily: fonts.medium,
    fontSize: 17,
  },
  empty: {
    color: colors.gray,
    fontFamily: fonts.medium,
    fontSize: 19,
  },
  toast: {
    alignSelf: 'center',
    backgroundColor: colors.black,
    borderRadius: 8,
    bottom: 16,
    color: colors.white,
    fontFamily: fonts.medium,
    fontSize: 18,
    overflow: 'hidden',
    paddingHorizontal: 18,
    paddingVertical: 10,
    position: 'absolute',
  },
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(17,17,17,0.45)',
    flex: 1,
    justifyContent: 'center',
    padding: 18,
  },
  modalCard: {
    backgroundColor: colors.white,
    borderRadius: 8,
    maxHeight: '92%',
    maxWidth: 620,
    padding: 20,
    width: '100%',
  },
  modalScrollContent: {
    paddingBottom: 12,
  },
  modalTitle: {
    color: colors.black,
    fontFamily: fonts.title,
    fontSize: 28,
    marginBottom: 12,
  },
  fieldBlock: {
    marginBottom: 12,
  },
  fieldLabel: {
    color: colors.black,
    fontFamily: fonts.medium,
    fontSize: 19,
    marginBottom: 7,
  },
  input: {
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.black,
    fontFamily: fonts.medium,
    fontSize: 19,
    minHeight: 48,
    paddingHorizontal: 12,
  },
  textArea: {
    minHeight: 92,
    paddingTop: 10,
    textAlignVertical: 'top',
  },
  pillWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  pillSelected: {
    backgroundColor: colors.black,
    borderColor: colors.black,
  },
  pillText: {
    color: colors.gray,
    fontFamily: fonts.medium,
    fontSize: 17,
  },
  pillTextSelected: {
    color: colors.white,
  },
  error: {
    color: colors.danger,
    fontFamily: fonts.medium,
    fontSize: 18,
    marginBottom: 8,
  },
  ratingRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 14,
  },
  ratingButton: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  ratingSelected: {
    backgroundColor: colors.black,
  },
  ratingText: {
    color: colors.gray,
    fontFamily: fonts.title,
    fontSize: 18,
  },
  ratingTextSelected: {
    color: colors.white,
  },
  modalActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  secondaryAction: {
    borderColor: colors.gold,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  secondaryActionText: {
    color: colors.darkGold,
    fontFamily: fonts.title,
    fontSize: 17,
  },
  modalSubmit: {
    backgroundColor: colors.gold,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  modalSubmitText: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 17,
  },
});
