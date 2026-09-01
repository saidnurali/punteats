import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    this.logErrorToSupabase(error, errorInfo);
  }

  async logErrorToSupabase(error: Error, errorInfo: ErrorInfo) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('app_crash_logs').insert([{
        app_version: '1.0.0', // Could use Application.nativeApplicationVersion
        platform: Platform.OS,
        error_message: error.toString(),
        error_stack: errorInfo.componentStack,
        user_id: user?.id || 'anonymous'
      }]);
    } catch (e) {
      console.error('Failed to log error to Supabase', e);
    }
  }

  handleRestart = () => {
    // Since expo-updates is not installed, simply clear the error state
    // so the tree attempts to re-render.
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <View style={styles.iconContainer}>
            <Ionicons name="warning" size={60} color="#F5A623" />
          </View>
          <Text style={styles.title}>⚠️ Qadaa dhacday.</Text>
          <Text style={styles.subtitle}>
            App-ku si otomaatig ah ayuu u xallinayaa cilladan. Fadlan dib u fur.
          </Text>
          <TouchableOpacity style={styles.button} onPress={this.handleRestart} activeOpacity={0.8}>
            <Ionicons name="refresh" size={20} color="#FFFFFF" style={styles.btnIcon} />
            <Text style={styles.buttonText}>🔄 Dib u Fur App-ka</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    padding: 24,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1A1A1A',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#6B6B6B',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  button: {
    flexDirection: 'row',
    backgroundColor: '#1B7D3C',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 25,
    alignItems: 'center',
    shadowColor: '#1B7D3C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  btnIcon: {
    marginRight: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
