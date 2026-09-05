import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from './supabase';
import { getCurrentUser } from './getCurrentUser';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter } from 'react-native';
import * as Notifications from 'expo-notifications';

export type NotificationType = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  type: string;
  is_read: boolean;
  order_id?: string;
  created_at: string;
};

type NotificationContextType = {
  notifications: NotificationType[];
  unreadCount: number;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
};

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<NotificationType[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  const fetchSession = async () => {
    try {
      const profile = await getCurrentUser();
      if (profile) {
        setUserId(profile.id);
        return profile.id;
      }
      setUserId(null);
      setNotifications([]);
    } catch (e) {
      console.error('Error fetching session for notifications', e);
    }
    return null;
  };

  const fetchNotifications = async (uid: string) => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', uid)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error && error.code !== '42P01') { // Ignore missing table error initially
        console.error('Error fetching notifications:', error);
      } else if (data) {
        setNotifications(data as NotificationType[]);
      }
    } catch (e) {
      console.error('Error in fetchNotifications:', e);
    }
  };

  useEffect(() => {
    let channel: any = null;

    const init = async () => {
      const uid = await fetchSession();
      if (uid) {
        await fetchNotifications(uid);

        // Realtime Subscription
        channel = supabase
          .channel(`public:notifications:user_${uid}`)
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` },
            (payload) => {
              const newNotification = payload.new as NotificationType;
              setNotifications((prev) => [newNotification, ...prev]);
            }
          )
          .subscribe();
      }
    };

    init();

    const authListener = DeviceEventEmitter.addListener('AUTH_STATE_CHANGED', (isAuth: boolean) => {
      if (isAuth) {
        init();
      } else {
        setUserId(null);
        setNotifications([]);
        if (channel) supabase.removeChannel(channel);
      }
    });

    return () => {
      authListener.remove();
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);


  // Calculate unread count
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  // Sync unread count to OS App Icon Badge
  useEffect(() => {
    Notifications.setBadgeCountAsync(unreadCount).catch(err => console.warn('Failed to set badge count:', err));
  }, [unreadCount]);

  const markAsRead = async (id: string) => {
    // Optimistic UI update
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    try {
      await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    } catch (e) {
      console.error('Error marking as read:', e);
    }
  };

  const markAllAsRead = async () => {
    if (!userId) return;
    // Optimistic UI update
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false);
    } catch (e) {
      console.error('Error marking all as read:', e);
    }
  };

  const refreshNotifications = async () => {
    if (userId) {
      await fetchNotifications(userId);
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
        refreshNotifications,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
