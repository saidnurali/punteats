import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import { Image } from 'expo-image';
import Animated, { FadeInDown } from 'react-native-reanimated';

const SCOOTER_IMG = 'https://cdn-icons-png.flaticon.com/512/2972/2972185.png';

const ACTION_CARDS = [
  {
    id: 'send',
    icon: 'cube-outline' as const,
    iconBg: '#1B7D3C',
    title: 'Send a Parcel',
    subtitle: 'Create a new delivery request',
    route: '/parcel/create',
    chevron: true,
  },
  {
    id: 'track',
    icon: 'navigate-outline' as const,
    iconBg: '#2563EB',
    title: 'Track Parcel',
    subtitle: 'Track your parcel in real-time',
    route: '/parcel/history',
    chevron: true,
  },
  {
    id: 'history',
    icon: 'time-outline' as const,
    iconBg: '#F5A623',
    title: 'Parcel History',
    subtitle: 'View all your parcel deliveries',
    route: '/parcel/history',
    chevron: true,
  },
];

export default function ParcelIndexScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Parcel Delivery</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Hero illustration */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.heroSection}>
          <Text style={styles.heroTitle}>Send a Parcel</Text>
          <Text style={styles.heroSubtitle}>Send packages anywhere in Garowe</Text>

          <View style={styles.illustrationWrap}>
            <Image
              source={{ uri: SCOOTER_IMG }}
              style={styles.scooterImg}
              contentFit="contain"
              cachePolicy="memory-disk"
            />
            {/* Pin decorations */}
            <View style={[styles.pin, styles.pinLeft]}>
              <Ionicons name="location" size={28} color="#EF4444" />
            </View>
            <View style={[styles.pin, styles.pinRight]}>
              <Ionicons name="location" size={22} color="#1B7D3C" />
            </View>
            <View style={[styles.pin, styles.pinTop]}>
              <Ionicons name="location" size={18} color="#9CA3AF" />
            </View>
          </View>
        </Animated.View>

        {/* Action Cards */}
        <View style={styles.cardsSection}>
          {ACTION_CARDS.map((card, idx) => (
            <Animated.View
              key={card.id}
              entering={FadeInDown.duration(400).delay(idx * 80)}
            >
              <TouchableOpacity
                style={styles.actionCard}
                activeOpacity={0.75}
                onPress={() => router.push(card.route as any)}
              >
                <View style={[styles.cardIconWrap, { backgroundColor: card.iconBg + '18' }]}>
                  <Ionicons name={card.icon} size={26} color={card.iconBg} />
                </View>
                <View style={styles.cardText}>
                  <Text style={styles.cardTitle}>{card.title}</Text>
                  <Text style={styles.cardSubtitle}>{card.subtitle}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#C4C4C4" />
              </TouchableOpacity>
            </Animated.View>
          ))}
        </View>

        {/* Info note */}
        <View style={styles.infoNote}>
          <Ionicons name="information-circle-outline" size={16} color="#6B6B6B" />
          <Text style={styles.infoText}>
            Deliveries available within Garowe, Puntland. Cash on delivery only.
          </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  // Hero
  heroSection: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 8,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#1A1A1A',
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 14,
    color: '#6B6B6B',
    textAlign: 'center',
    marginTop: 6,
  },
  illustrationWrap: {
    width: 200,
    height: 160,
    marginTop: 16,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  scooterImg: {
    width: 160,
    height: 130,
  },
  pin: {
    position: 'absolute',
  },
  pinLeft: { left: 0, bottom: 20 },
  pinRight: { right: 0, top: 20 },
  pinTop: { top: 0, left: 30 },

  // Cards
  cardsSection: {
    marginTop: 24,
    gap: 12,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  cardText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#6B6B6B',
    marginTop: 2,
  },

  // Info
  infoNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 32,
    gap: 8,
    paddingHorizontal: 4,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: '#6B6B6B',
    lineHeight: 18,
  },
});
