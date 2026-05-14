import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, fonts } from '../theme';
import {
  DURATION_OPTIONS,
  addMinutesToTime,
  minutesBetweenTimes,
  normalizeTimeInput,
} from '../utils/format';

export function TimeInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        keyboardType="numbers-and-punctuation"
        placeholder="09:00"
        placeholderTextColor={colors.muted}
        style={styles.input}
        value={value}
        onBlur={() => onChange(normalizeTimeInput(value))}
        onChangeText={onChange}
      />
    </View>
  );
}

export function TimeRangeFields({
  horaInicio,
  horaFin,
  onHoraFinChange,
  onHoraInicioChange,
}: {
  horaInicio: string;
  horaFin: string;
  onHoraFinChange: (value: string) => void;
  onHoraInicioChange: (value: string) => void;
}) {
  const duration = minutesBetweenTimes(horaInicio, horaFin);

  const setDuration = (minutes: number) => {
    const nextEnd = addMinutesToTime(normalizeTimeInput(horaInicio), minutes);
    if (nextEnd) onHoraFinChange(nextEnd);
  };

  return (
    <>
      <TimeInput
        label="Hora de inicio"
        value={horaInicio}
        onChange={(value) => {
          const previousDuration = duration && duration > 0 ? duration : 60;
          const normalized = normalizeTimeInput(value);
          onHoraInicioChange(value);

          const nextEnd = addMinutesToTime(normalized, previousDuration);
          if (nextEnd) onHoraFinChange(nextEnd);
        }}
      />

      <View style={styles.fieldBlock}>
        <Text style={styles.fieldLabel}>Duracion</Text>
        <View style={styles.durationRow}>
          {DURATION_OPTIONS.map((minutes) => (
            <Pressable
              key={minutes}
              style={[styles.durationButton, duration === minutes && styles.durationSelected]}
              onPress={() => setDuration(minutes)}
            >
              <Text style={[styles.durationText, duration === minutes && styles.durationTextSelected]}>
                {minutes} min
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.fieldBlock}>
        <Text style={styles.fieldLabel}>Hora de fin</Text>
        <Text style={styles.readonlyValue}>{horaFin || '--:--'}</Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
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
  durationRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  durationButton: {
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  durationSelected: {
    backgroundColor: colors.black,
    borderColor: colors.black,
  },
  durationText: {
    color: colors.gray,
    fontFamily: fonts.medium,
    fontSize: 17,
  },
  durationTextSelected: {
    color: colors.white,
  },
  readonlyValue: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.black,
    fontFamily: fonts.medium,
    fontSize: 19,
    minHeight: 48,
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
});
