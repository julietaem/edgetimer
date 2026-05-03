import { View } from 'react-native';
import {
  formStyles,
  PrimaryButton,
  SecondaryButton,
} from '../components/FormControls';

export function RoleScreen({
  onBarber,
  onClient,
}: {
  onBarber: () => void;
  onClient: () => void;
}) {
  return (
    <View style={formStyles.form}>
      <PrimaryButton label="Barbero" onPress={onBarber} />
      <SecondaryButton label="Usuario" onPress={onClient} />
    </View>
  );
}
