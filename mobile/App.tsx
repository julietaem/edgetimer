import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { HomeScreen } from './src/screens/Home';
import { LoginScreen } from './src/screens/Login';
import { RegisterScreen } from './src/screens/Register';
import { RoleScreen } from './src/screens/Role';
import { colors } from './src/theme';
import type { Role, Screen, SessionProfile } from './src/types';

export default function App() {
  const [screen, setScreen] = useState<Screen>('role');
  const [role, setRole] = useState<Role>('cliente');
  const [profile, setProfile] = useState<SessionProfile | null>(null);
  const [feedback, setFeedback] = useState('');

  const title = useMemo(() => {
    if (screen === 'role') return 'Bienvenido';
    if (screen === 'register') return 'Registrarse';
    if (screen === 'login') return 'Iniciar Sesión';
    return '';
  }, [screen]);

  const goToLogin = (nextRole: Role) => {
    setFeedback('');
    setRole(nextRole);
    setScreen('login');
  };

  const goToRegister = () => {
    setFeedback('');
    setRole('cliente');
    setScreen('register');
  };

  const handleLoginSuccess = (nextProfile: SessionProfile) => {
    setProfile(nextProfile);
    setRole(nextProfile.role);
    setFeedback('');
    setScreen('home');
  };

  const handleLogout = () => {
    setProfile(null);
    setFeedback('');
    setRole('cliente');
    setScreen('role');
  };

  if (screen === 'home') {
    return (
      <HomeScreen
        profile={profile}
        role={profile?.role ?? role}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.brandMark}>
            <Text style={styles.brandLetters}>AC</Text>
          </View>
          <Text style={styles.title}>{title}</Text>

          {screen === 'role' && (
            <RoleScreen
              onBarber={() => goToLogin('barbero')}
              onClient={goToRegister}
            />
          )}

          {screen === 'register' && (
            <RegisterScreen
              feedback={feedback}
              onFeedback={setFeedback}
              onBackToRoles={() => {
                setFeedback('');
                setScreen('role');
              }}
              onRegistered={() => {
                setFeedback('Registro exitoso. Ahora inicia sesión.');
                setScreen('login');
              }}
              onLogin={() => goToLogin('cliente')}
            />
          )}

          {screen === 'login' && (
            <LoginScreen
              feedback={feedback}
              role={role}
              onFeedback={setFeedback}
              onBackToRoles={() => {
                setFeedback('');
                setScreen('role');
              }}
              onLoginSuccess={handleLoginSuccess}
              onRegister={goToRegister}
            />
          )}

          {profile && <Text style={styles.hiddenText}>{profile.usuario}</Text>}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  brandMark: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.gold,
    marginBottom: 28,
  },
  brandLetters: {
    color: colors.lightGold,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 0,
  },
  title: {
    color: colors.black,
    fontSize: 38,
    fontWeight: '800',
    marginBottom: 28,
    textAlign: 'center',
  },
  hiddenText: {
    display: 'none',
  },
});
