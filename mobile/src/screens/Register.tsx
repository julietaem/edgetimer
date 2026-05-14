import { useState } from 'react';
import { View } from 'react-native';
import api from '../api';
import {
  Feedback,
  formStyles,
  InlineLink,
  Input,
  keyIcon,
  PrimaryButton,
  userIcon,
  phoneIcon,
} from '../components/FormControls';
import { readError } from '../utils/errors';

export function RegisterScreen({
  feedback,
  onFeedback,
  onBackToRoles,
  onRegistered,
  onLogin,
}: {
  feedback: string;
  onFeedback: (message: string) => void;
  onBackToRoles: () => void;
  onRegistered: () => void;
  onLogin: () => void;
}) {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    onFeedback('');

    try {
      await api.post('/auth/register-client', {
        nombre,
        email,
        telefono,
        password,
      });
      onRegistered();
    } catch (error) {
      onFeedback(readError(error, 'No fue posible crear la cuenta'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={formStyles.form}>
      <Input
        icon={userIcon}
        placeholder="Nombre"
        value={nombre}
        onChangeText={setNombre}
      />
      <Input
        icon={userIcon}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <Input
        icon={phoneIcon}
        placeholder="Teléfono"
        value={telefono}
        onChangeText={setTelefono}
        keyboardType="phone-pad"
      />
      <Input
        icon={keyIcon}
        placeholder="Contraseña"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <Feedback message={feedback} />
      <PrimaryButton label="Registrarse" onPress={submit} loading={loading} />
      <InlineLink
        prefix="¿Ya tienes cuenta?"
        label="Iniciar Sesión"
        onPress={onLogin}
      />
      <InlineLink
        label="Volver a roles"
        onPress={onBackToRoles}
      />
    </View>
  );
}
