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
} from '../components/FormControls';
import type { Role, SessionProfile } from '../types';
import { readError } from '../utils/errors';

export function LoginScreen({
  feedback,
  role,
  onFeedback,
  onBackToRoles,
  onLoginSuccess,
  onRegister,
}: {
  feedback: string;
  role: Role;
  onFeedback: (message: string) => void;
  onBackToRoles: () => void;
  onLoginSuccess: (profile: SessionProfile) => void;
  onRegister: () => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    onFeedback('');

    try {
      const response = await api.post('/auth/login', {
        role,
        email,
        password,
      });
      api.defaults.headers.common.Authorization = `Bearer ${response.data.session.accessToken}`;
      onLoginSuccess(response.data.profile);
    } catch (error) {
      onFeedback(readError(error, 'No fue posible iniciar sesión'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={formStyles.form}>
      <Input
        icon={userIcon}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <Input
        icon={keyIcon}
        placeholder="Contraseña"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <Feedback message={feedback} />
      <PrimaryButton
        label="Iniciar Sesión"
        onPress={submit}
        loading={loading}
      />
      {role === 'cliente' && (
        <InlineLink
          prefix="¿No tienes cuenta?"
          label="Registrarse"
          onPress={onRegister}
        />
      )}
      <InlineLink
        label="Volver a roles"
        onPress={onBackToRoles}
      />
    </View>
  );
}
