import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useNotifications, NotificationType } from '@/lib/NotificationContext';

export default function NotificationScreen() {
  const router = useRouter();
  const { notifications, markAsRead, markAllAsRead, refreshNotifications } = useNotifications();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshNotifications();
    setRefreshing(false);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
    const datePart = date.toLocaleDateString('en-GB', options); // "19 Dec 2026"
    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${datePart} | ${hours}:${minutes} ${ampm}`;
  };

  const getIconProps = (type: string, title: string) => {
    const lowerTitle = title.toLowerCase();
    const lowerType = type?.toLowerCase() || '';
    
    if (lowerTitle.includes('success') || lowerTitle.includes('delivered') || lowerType === 'success') {
      return { name: 'bag-check-outline' as const, color: '#1B7D3C', bgColor: '#E8F5E9' };
    }
    if (lowerTitle.includes('cancel') || lowerType === 'error') {
      return { name: 'close-circle-outline' as const, color: '#EF4444', bgColor: '#FEE2E2' };
    }
    if (lowerTitle.includes('delivery') || lowerTitle.includes('way') || lowerType === 'delivery') {
      return { name: 'truck-outline' as const, color: '#F5A623', bgColor: '#FEF3C7' };
    }
    return { name: 'notifications-outline' as const, color: '#3B82F6', bgColor: '#DBEAFE' };
  };

  const renderItem = ({ item }: { item: NotificationType }) => {
    const iconProps = getIconProps(item.type, item.title);

    const handlePress = async () => {
      if (!item.is_read) {
        await markAsRead(item.id);
      }
      if (item.order_id) {
        router.push(`/order-tracking?id=${item.order_id}`);
      }
    };

    return (
      <TouchableOpacity 
        style={[styles.notificationCard, !item.is_read && styles.unreadCard]} 
        activeOpacity={0.7}
        onPress={handlePress}
      >
        <View style={[styles.iconContainer, { backgroundColor: iconProps.bgColor }]}>
          <Ionicons name={iconProps.name} size={24} color={iconProps.color} />
        </View>
        <View style={styles.contentContainer}>
          <View style={styles.headerRow}>
            <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
            {!item.is_read && (
              <View style={styles.newBadge}>
                <Text style={styles.newBadgeText}>New</Text>
              </View>
            )}
          </View>
          <Text style={styles.date}>{formatDate(item.created_at)}</Text>
          <Text style={styles.body} numberOfLines={2}>{item.body}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notification</Text>
        <TouchableOpacity style={styles.menuButton} onPress={markAllAsRead}>
          <MaterialCommunityIcons name="playlist-check" size={24} color="#1A1A1A" />
        </TouchableOpacity>
      </View>

      {/* List */}
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1B7D3C']} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="notifications-off-outline" size={64} color="#D1D5DB" />
            <Text style={styles.emptyText}>No notifications yet</Text>
            <Text style={styles.emptySubtext}>We'll notify you when something arrives.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F8F8',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  menuButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: 20,
    flexGrow: 1,
  },
  notificationCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  unreadCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    flex: 1,
    marginRight: 8,
  },
  newBadge: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  newBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  date: {
    fontSize: 12,
    color: '#6B6B6B',
    marginBottom: 8,
  },
  body: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 100,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6B6B6B',
    marginTop: 8,
    textAlign: 'center',
  }
});
