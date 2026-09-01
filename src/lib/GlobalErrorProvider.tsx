/**
 * GlobalErrorProvider
 * ─────────────────────────────────────────────────────────────────
 * Provides app-wide:
 *  1. Offline / Online network banner (polls every 5s + on AppState change)
 *  2. Toast notification system (error, success, warning)
 *  3. Helper hooks: useToast(), useNetworkStatus()
 *
 * No extra packages required — uses built-in fetch + AppState.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  AppState,
  AppStateStatus,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ─── Types ────────────────────────────────────────────────────────────────────

type ToastType = 'error' | 'success' | 'warning' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface GlobalErrorContextType {
  isOnline: boolean;
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  showError: (message: string) => void;
  showSuccess: (message: string) => void;
  showWarning: (message: string) => void;
}

const GlobalErrorContext = createContext<GlobalErrorContextType>({
  isOnline: true,
  showToast: () => {},
  showError: () => {},
  showSuccess: () => {},
  showWarning: () => {},
});

// ─── Network Check (no extra package) ─────────────────────────────────────────

const CONNECTIVITY_CHECK_URL = 'https://www.gstatic.com/generate_204';

async function checkConnection(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(CONNECTIVITY_CHECK_URL, {
      method: 'HEAD',
      signal: controller.signal,
      cache: 'no-cache',
    });
    clearTimeout(timeout);
    return res.status < 400;
  } catch {
    return false;
  }
}

// ─── Toast Item Component ──────────────────────────────────────────────────────

const TOAST_ICONS: Record<ToastType, string> = {
  error: 'close-circle',
  success: 'checkmark-circle',
  warning: 'warning',
  info: 'information-circle',
};

const TOAST_COLORS: Record<ToastType, string> = {
  error: '#DC2626',
  success: '#1B7D3C',
  warning: '#D97706',
  info: '#2563EB',
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 280, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 18 }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 20, duration: 250, useNativeDriver: true }),
      ]).start(onDismiss);
    }, toast.duration || 3500);

    return () => clearTimeout(timer);
  }, []);

  const color = TOAST_COLORS[toast.type];

  return (
    <Animated.View style={[styles.toast, { opacity, transform: [{ translateY }], borderLeftColor: color }]}>
      <Ionicons name={TOAST_ICONS[toast.type] as any} size={20} color={color} />
      <Text style={styles.toastText} numberOfLines={3}>{toast.message}</Text>
      <TouchableOpacity onPress={onDismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons name="close" size={16} color="#6B7280" />
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Offline Banner ────────────────────────────────────────────────────────────

function OfflineBanner() {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-80)).current;

  useEffect(() => {
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      damping: 18,
    }).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.offlineBanner,
        { paddingTop: insets.top + 8, transform: [{ translateY }] },
      ]}
    >
      <Ionicons name="cloud-offline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
      <Text style={styles.offlineText}>
        ⚠️ Internet-ku waa maqan yahay. Fadlan hubi Wi-Fi ama Data-daada.
      </Text>
    </Animated.View>
  );
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function GlobalErrorProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const insets = useSafeAreaInsets();

  const runCheck = useCallback(async () => {
    const online = await checkConnection();
    setIsOnline(prev => {
      if (prev !== online) return online;
      return prev;
    });
  }, []);

  // Poll every 6 seconds + re-check on AppState change (background→foreground)
  useEffect(() => {
    runCheck();
    intervalRef.current = setInterval(runCheck, 6000);

    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') runCheck();
    });

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      sub.remove();
    };
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'info', duration = 3500) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts(prev => [...prev.slice(-2), { id, message, type, duration }]); // Max 3 at once
  }, []);

  const showError = useCallback((msg: string) => showToast(msg, 'error', 4500), [showToast]);
  const showSuccess = useCallback((msg: string) => showToast(msg, 'success', 3000), [showToast]);
  const showWarning = useCallback((msg: string) => showToast(msg, 'warning', 4000), [showToast]);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <GlobalErrorContext.Provider value={{ isOnline, showToast, showError, showSuccess, showWarning }}>
      {children}

      {/* Offline Banner — sits below status bar */}
      {!isOnline && <OfflineBanner />}

      {/* Toast Stack — bottom of screen, above tab bar */}
      <View style={[styles.toastContainer, { bottom: insets.bottom + 80 }]} pointerEvents="box-none">
        {toasts.map(toast => (
          <ToastItem key={toast.id} toast={toast} onDismiss={() => dismissToast(toast.id)} />
        ))}
      </View>
    </GlobalErrorContext.Provider>
  );
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useToast() {
  return useContext(GlobalErrorContext);
}

export function useNetworkStatus() {
  const { isOnline } = useContext(GlobalErrorContext);
  return isOnline;
}

// ─── GPS Banner (standalone, used in OrderTracking) ───────────────────────────

export function GpsBanner({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.gpsBanner} onPress={onPress} activeOpacity={0.85}>
      <Ionicons name="location-outline" size={18} color="#D97706" style={{ marginRight: 8 }} />
      <Text style={styles.gpsText} numberOfLines={2}>
        📍 GPS-ku waa dansan yahay. Shid Location-ka si aad u aragto wadaha.
      </Text>
      <View style={styles.gpsBadge}>
        <Text style={styles.gpsBadgeText}>Fur</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  offlineBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    backgroundColor: '#1F2937',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  offlineText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  toastContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9998,
    gap: 8,
  },
  toast: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 8,
    gap: 10,
  },
  toastText: {
    flex: 1,
    fontSize: 13.5,
    color: '#1A1A1A',
    fontWeight: '600',
    lineHeight: 19,
  },
  gpsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
    shadowColor: '#D97706',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  gpsText: {
    flex: 1,
    fontSize: 13,
    color: '#92400E',
    fontWeight: '600',
    lineHeight: 18,
  },
  gpsBadge: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginLeft: 8,
  },
  gpsBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
});
