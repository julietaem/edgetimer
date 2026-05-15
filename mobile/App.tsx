import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { AppShell } from './src/components/AppShell';
import api from './src/api';
import { AgendaScreen } from './src/screens/Agenda';
import { HomeScreen } from './src/screens/Home';
import { LoginScreen } from './src/screens/Login';
import { PerfilScreen } from './src/screens/Perfil';
import { RegisterScreen } from './src/screens/Register';
import { RoleScreen } from './src/screens/Role';
import { colors, fonts } from './src/theme';
import type { AppScreen, Role, Screen, SessionProfile } from './src/types';

const logo = require('./assets/icon.png');

export default function App() {
  const [screen, setScreen] = useState<Screen>('role');
  const [role, setRole] = useState<Role>('cliente');
  const [profile, setProfile] = useState<SessionProfile | null>(null);
  const [barberoId, setBarberoId] = useState<string | undefined>();
  const [feedback, setFeedback] = useState('');
  const [fontsLoaded] = useFonts({
    Satoshi: require('./assets/fonts/Satoshi-Variable.ttf'),
    SatoshiItalic: require('./assets/fonts/Satoshi-VariableItalic.ttf'),
    DarkerGrotesqueLight: require('./assets/fonts/DarkerGrotesque-Light.ttf'),
    DarkerGrotesqueMedium: require('./assets/fonts/DarkerGrotesque-Medium.ttf'),
  });

  const title = useMemo(() => {
    if (screen === 'role') return 'Bienvenido';
    if (screen === 'register') return 'Registrarse';
    if (screen === 'login') return 'Iniciar Sesion';
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
    delete api.defaults.headers.common.Authorization;
    setProfile(null);
    setBarberoId(undefined);
    setFeedback('');
    setRole('cliente');
    setScreen('role');
  };

  if (!fontsLoaded) {
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator color={colors.gold} />
      </SafeAreaView>
    );
  }

  if (screen === 'home' || screen === 'agenda' || screen === 'perfil') {
    const appScreen = screen as AppScreen;
    const activeRole = profile?.role ?? role;

    return (
      <AppShell
        activeScreen={appScreen}
        onLogout={handleLogout}
        onNavigate={(nextScreen) => {
          if (nextScreen === 'perfil') {
            if (profile?.role === 'barbero') {
              setBarberoId(profile.id);
            } else {
              setBarberoId(undefined);
            }
          }
          setScreen(nextScreen);
        }}
      >
        {appScreen === 'home' ? (
          <HomeScreen
            profile={profile}
            role={activeRole}
            onViewBarbero={(id) => {
              setBarberoId(id);
              setScreen('perfil');
            }}
          />
        ) : appScreen === 'agenda' ? (
          <AgendaScreen profile={profile} role={activeRole} />
        ) : (
          <PerfilScreen
            profile={profile}
            role={activeRole}
            barberoId={barberoId}
            onBack={() => {
              setBarberoId(undefined);
              setScreen('home');
            }}
          />
        )}
      </AppShell>
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
          <Image source={logo} style={styles.logo} />
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
                setFeedback('Registro exitoso. Ahora inicia sesion.');
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
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
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
  logo: {
    width: 118,
    height: 118,
    borderRadius: 28,
    marginBottom: 22,
  },
  title: {
    color: colors.black,
    fontFamily: fonts.title,
    fontSize: 38,
    marginBottom: 28,
    textAlign: 'center',
  },
  hiddenText: {
    display: 'none',
  },
});
