import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { getCurrentUser } from "@/lib/getCurrentUser";
import { PACKAGE_TYPES, PACKAGE_SIZES, PackageType, PackageSize } from '@/lib/parcelPricing';

// ─── Step Indicator ──────────────────────────────────────────────────────
const TOTAL_STEPS = 4;

const StepIndicator = ({ current }: { current: number }) => (
  <View style={styles.stepRow}>
    {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
      <React.Fragment key={i}>
        <View
          style={[
            styles.stepDot,
            i < current ? styles.stepDone : i === current ? styles.stepActive : styles.stepIdle,
          ]}
        >
          {i < current ? (
            <Ionicons name="checkmark" size={12} color="#FFF" />
          ) : (
            <Text style={[styles.stepNum, i === current && { color: '#FFF' }]}>{i + 1}</Text>
          )}
        </View>
        {i < TOTAL_STEPS - 1 && (
          <View style={[styles.stepLine, i < current && styles.stepLineDone]} />
        )}
      </React.Fragment>
    ))}
  </View>
);

// ─── Radio Option ────────────────────────────────────────────────────────
const RadioOption = ({
  icon, title, subtitle, selected, onSelect,
}: {
  icon: any; title: string; subtitle?: string; selected: boolean; onSelect: () => void;
}) => (
  <TouchableOpacity style={[styles.radioOption, selected && styles.radioOptionSelected]} onPress={onSelect} activeOpacity={0.7}>
    <View style={[styles.radioIcon, selected && styles.radioIconSelected]}>
      <Ionicons name={icon} size={20} color={selected ? '#1B7D3C' : '#6B6B6B'} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={[styles.radioTitle, selected && { color: '#1B7D3C' }]}>{title}</Text>
      {subtitle ? <Text style={styles.radioSubtitle}>{subtitle}</Text> : null}
    </View>
    <View style={[styles.radioCircle, selected && styles.radioCircleFilled]}>
      {selected && <View style={styles.radioInner} />}
    </View>
  </TouchableOpacity>
);

// ─── Selector Pill ───────────────────────────────────────────────────────
const SelectorPill = ({ label, selected, onSelect }: { label: string; selected: boolean; onSelect: () => void }) => (
  <TouchableOpacity
    style={[styles.pill, selected && styles.pillSelected]}
    onPress={onSelect}
    activeOpacity={0.75}
  >
    <Text style={[styles.pillText, selected && styles.pillTextSelected]}>{label}</Text>
  </TouchableOpacity>
);

// ─── Main Screen ─────────────────────────────────────────────────────────
export default function CreateParcelScreen() {
  const router = useRouter();
  const [step, setStep] = useState(0);

  // Step 1 — Pickup
  const [pickupType, setPickupType] = useState<'current' | 'saved' | null>(null);
  const [pickupAddress, setPickupAddress] = useState('');
  const [savedAddresses, setSavedAddresses] = useState<any[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(false);

  // Step 2 — Recipient
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');

  // Step 3 — Delivery
  const [deliveryType, setDeliveryType] = useState<'current' | 'saved' | 'manual' | null>(null);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [manualDelivery, setManualDelivery] = useState('');

  // Step 4 — Package
  const [packageType, setPackageType] = useState<PackageType | null>(null);
  const [packageSize, setPackageSize] = useState<PackageSize | null>(null);
  const [deliveryNote, setDeliveryNote] = useState('');

  const loadSavedAddresses = useCallback(async () => {
    if (savedAddresses.length > 0 || loadingAddresses) return;
    setLoadingAddresses(true);
    try {
      const profile = await getCurrentUser();
      if (!profile) return;
      const { data } = await supabase
        .from('saved_addresses')
        .select('*')
        .eq('user_id', profile.id)
        .order('is_default', { ascending: false });
      if (data) setSavedAddresses(data);
    } catch { }
    finally { setLoadingAddresses(false); }
  }, [savedAddresses.length, loadingAddresses]);

  // ── Validation per step ──────────────────────────────────────────────
  const validateStep = (): boolean => {
    if (step === 0) {
      if (!pickupAddress) {
        Alert.alert('Required', 'Please select a pickup location.');
        return false;
      }
    }
    if (step === 1) {
      if (!recipientName.trim()) { Alert.alert('Required', 'Please enter the recipient name.'); return false; }
      const cleanPhone = recipientPhone.trim().replace(/\s/g, '');
      if (cleanPhone.length < 8) { Alert.alert('Invalid Phone', 'Please enter a valid phone number.'); return false; }
    }
    if (step === 2) {
      if (!deliveryAddress) { Alert.alert('Required', 'Please select a delivery location.'); return false; }
    }
    if (step === 3) {
      if (!packageType) { Alert.alert('Required', 'Please select a package type.'); return false; }
      if (!packageSize) { Alert.alert('Required', 'Please select a package size.'); return false; }
    }
    return true;
  };

  const handleNext = () => {
    if (!validateStep()) return;
    if (step < TOTAL_STEPS - 1) {
      setStep(s => s + 1);
      if (step === 0 || step === 2) loadSavedAddresses();
    } else {
      // Navigate to review screen with all params
      router.push({
        pathname: '/parcel/review',
        params: {
          pickupAddress,
          recipientName: recipientName.trim(),
          recipientPhone: recipientPhone.trim(),
          deliveryAddress,
          packageType: packageType!,
          packageSize: packageSize!,
          deliveryNote: deliveryNote.trim(),
        },
      });
    }
  };

  const handlePickupSelect = (type: 'current' | 'saved', address: string) => {
    setPickupType(type);
    setPickupAddress(address);
  };

  const handleDeliverySelect = (type: 'current' | 'saved' | 'manual', address: string) => {
    setDeliveryType(type);
    setDeliveryAddress(address);
  };

  // ── Step renders ────────────────────────────────────────────────────
  const renderStep0 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepSectionTitle}>1. Pickup Location</Text>
      <Text style={styles.stepSectionSubtitle}>Select pickup location</Text>

      <RadioOption
        icon="location"
        title="Use current location"
        subtitle="Garowe, Puntland"
        selected={pickupType === 'current'}
        onSelect={() => handlePickupSelect('current', 'Garowe, Puntland, Somalia')}
      />

      <RadioOption
        icon="map"
        title="Choose on map"
        subtitle="Select location on map"
        selected={pickupType === 'map' as any}
        onSelect={() => {
          Alert.alert('Coming Soon', 'Map picker will be available soon. Using Garowe, Puntland as default.');
          handlePickupSelect('current', 'Garowe, Puntland, Somalia');
        }}
      />

      {savedAddresses.map(addr => (
        <RadioOption
          key={addr.id}
          icon="bookmark-outline"
          title={addr.label || 'Saved Address'}
          subtitle={addr.address}
          selected={pickupAddress === addr.address}
          onSelect={() => handlePickupSelect('saved', addr.address)}
        />
      ))}

      <RadioOption
        icon="albums-outline"
        title="Saved addresses"
        subtitle={loadingAddresses ? 'Loading...' : 'Select from saved addresses'}
        selected={false}
        onSelect={() => { loadSavedAddresses(); }}
      />

      {pickupAddress ? (
        <View style={styles.selectedBadge}>
          <Ionicons name="checkmark-circle" size={16} color="#1B7D3C" />
          <Text style={styles.selectedBadgeText} numberOfLines={1}>{pickupAddress}</Text>
        </View>
      ) : null}
    </View>
  );

  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepSectionTitle}>2. Recipient Information</Text>
      <Text style={styles.stepSectionSubtitle}>Who are you sending to?</Text>

      <Text style={styles.inputLabel}>Recipient Name</Text>
      <TextInput
        style={styles.textInput}
        placeholder="Enter recipient name"
        placeholderTextColor="#AAAAAA"
        value={recipientName}
        onChangeText={setRecipientName}
        autoCapitalize="words"
      />

      <Text style={styles.inputLabel}>Recipient Phone</Text>
      <View style={styles.phoneInputRow}>
        <View style={styles.phonePrefix}>
          <Text style={styles.phonePrefixText}>🇸🇴 +252</Text>
        </View>
        <TextInput
          style={[styles.textInput, { flex: 1, borderLeftWidth: 0, borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }]}
          placeholder="Enter recipient phone"
          placeholderTextColor="#AAAAAA"
          value={recipientPhone}
          onChangeText={setRecipientPhone}
          keyboardType="phone-pad"
        />
      </View>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepSectionTitle}>3. Delivery Location</Text>
      <Text style={styles.stepSectionSubtitle}>Select delivery location</Text>

      <RadioOption
        icon="location"
        title="Use current location"
        subtitle="Garowe, Puntland"
        selected={deliveryType === 'current'}
        onSelect={() => handleDeliverySelect('current', 'Garowe, Puntland, Somalia')}
      />

      <RadioOption
        icon="map"
        title="Choose on map"
        subtitle="Select location on map"
        selected={deliveryType === 'map' as any}
        onSelect={() => {
          Alert.alert('Coming Soon', 'Map picker will be available soon. Please enter address manually.');
          setDeliveryType('manual');
        }}
      />

      {savedAddresses.map(addr => (
        <RadioOption
          key={addr.id}
          icon="bookmark-outline"
          title={addr.label || 'Saved Address'}
          subtitle={addr.address}
          selected={deliveryAddress === addr.address}
          onSelect={() => handleDeliverySelect('saved', addr.address)}
        />
      ))}

      <RadioOption
        icon="albums-outline"
        title="Saved addresses"
        subtitle={loadingAddresses ? 'Loading...' : 'Select from saved addresses'}
        selected={false}
        onSelect={loadSavedAddresses}
      />

      <Text style={styles.inputLabel}>Or enter address manually</Text>
      <TextInput
        style={styles.textInput}
        placeholder="e.g. Wadajir District, Garowe"
        placeholderTextColor="#AAAAAA"
        value={deliveryType === 'manual' ? manualDelivery : ''}
        onChangeText={text => {
          setManualDelivery(text);
          setDeliveryType('manual');
          setDeliveryAddress(text);
        }}
      />

      {deliveryAddress ? (
        <View style={styles.selectedBadge}>
          <Ionicons name="checkmark-circle" size={16} color="#1B7D3C" />
          <Text style={styles.selectedBadgeText} numberOfLines={1}>{deliveryAddress}</Text>
        </View>
      ) : null}
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepSectionTitle}>4. Package Details</Text>
      <Text style={styles.stepSectionSubtitle}>Tell us about your package</Text>

      <Text style={styles.inputLabel}>Package Type</Text>
      <View style={styles.pillRow}>
        {PACKAGE_TYPES.map(type => (
          <SelectorPill
            key={type}
            label={type}
            selected={packageType === type}
            onSelect={() => setPackageType(type)}
          />
        ))}
      </View>

      <Text style={[styles.inputLabel, { marginTop: 20 }]}>Package Size</Text>
      <View style={styles.pillRow}>
        {PACKAGE_SIZES.map(size => (
          <SelectorPill
            key={size}
            label={size}
            selected={packageSize === size}
            onSelect={() => setPackageSize(size)}
          />
        ))}
      </View>

      <Text style={[styles.inputLabel, { marginTop: 20 }]}>Delivery Note (Optional)</Text>
      <TextInput
        style={[styles.textInput, { height: 90, textAlignVertical: 'top', paddingTop: 12 }]}
        placeholder="Any special instructions? e.g. Call recipient when you arrive."
        placeholderTextColor="#AAAAAA"
        value={deliveryNote}
        onChangeText={setDeliveryNote}
        multiline
        maxLength={200}
      />
    </View>
  );

  const STEP_RENDERERS = [renderStep0, renderStep1, renderStep2, renderStep3];
  const STEP_LABELS = ['Pickup', 'Recipient', 'Delivery', 'Package'];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => (step > 0 ? setStep(s => s - 1) : router.back())}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Parcel</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Step Indicator */}
      <View style={styles.stepIndicatorWrap}>
        <StepIndicator current={step} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {STEP_RENDERERS[step]()}
        </ScrollView>

        {/* Continue Button */}
        <View style={styles.bottomBar}>
          <TouchableOpacity style={styles.continueBtn} onPress={handleNext} activeOpacity={0.85}>
            <Text style={styles.continueBtnText}>
              {step < TOTAL_STEPS - 1 ? 'Continue' : 'Review Delivery'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const GREEN = '#1B7D3C';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A1A' },

  stepIndicatorWrap: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    alignItems: 'center',
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDone: { backgroundColor: GREEN },
  stepActive: { backgroundColor: GREEN },
  stepIdle: { backgroundColor: '#E5E7EB' },
  stepNum: { fontSize: 13, fontWeight: '700', color: '#9CA3AF' },
  stepLine: { flex: 1, height: 2, backgroundColor: '#E5E7EB', marginHorizontal: 4 },
  stepLineDone: { backgroundColor: GREEN },

  scrollContent: { paddingHorizontal: 20, paddingBottom: 120 },
  stepContent: { paddingTop: 8 },
  stepSectionTitle: { fontSize: 20, fontWeight: '800', color: '#1A1A1A', marginBottom: 4 },
  stepSectionSubtitle: { fontSize: 14, color: '#6B6B6B', marginBottom: 20 },

  // Radio options
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
  },
  radioOptionSelected: { borderColor: GREEN, backgroundColor: '#F0FDF4' },
  radioIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  radioIconSelected: { backgroundColor: '#DCFCE7' },
  radioTitle: { fontSize: 15, fontWeight: '600', color: '#1A1A1A' },
  radioSubtitle: { fontSize: 12, color: '#6B6B6B', marginTop: 2 },
  radioCircle: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center' },
  radioCircleFilled: { borderColor: GREEN },
  radioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: GREEN },

  selectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
    marginTop: 4,
  },
  selectedBadgeText: { flex: 1, fontSize: 13, color: '#1B7D3C', fontWeight: '500' },

  // Inputs
  inputLabel: { fontSize: 14, fontWeight: '600', color: '#1A1A1A', marginBottom: 8 },
  textInput: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: '#1A1A1A',
    backgroundColor: '#FAFAFA',
    marginBottom: 4,
  },
  phoneInputRow: { flexDirection: 'row', marginBottom: 4 },
  phonePrefix: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    paddingHorizontal: 14,
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
  phonePrefixText: { fontSize: 14, color: '#1A1A1A', fontWeight: '600' },

  // Pills
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  pillSelected: { borderColor: GREEN, backgroundColor: '#F0FDF4' },
  pillText: { fontSize: 14, color: '#6B6B6B', fontWeight: '500' },
  pillTextSelected: { color: GREEN, fontWeight: '700' },

  // Bottom bar
  bottomBar: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  continueBtn: {
    backgroundColor: GREEN,
    paddingVertical: 17,
    borderRadius: 25,
    alignItems: 'center',
  },
  continueBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
