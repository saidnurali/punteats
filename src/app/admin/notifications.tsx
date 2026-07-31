import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';

const PRESETS = [
  {
    label: 'Offer 20% Off',
    title: '20% Qiimo Dhimis Maanta! 🍔',
    body: 'Geli koodhka PUNTEATS20 marka aad amrayso Pizza ama Burger.',
  },
  {
    label: 'New Restaurant Added',
    title: 'Makhaayad Cusub! 🍽️',
    body: 'Makhaayad cusub ayaa lagu daray app-ka. Hada dalbo cuntada aad jeceshahay!',
  },
  {
    label: 'Weather Delay',
    title: 'Cimilada Darteed 🌧️',
    body: 'Cimilada oo xun awgeed, waxaa dhici karta in dalabaadka qaar ay soo daahaan. Raali ahow.',
  },
];

export default function AdminNotifications() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) {
      Alert.alert('Error', 'Please fill in both title and body.');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-broadcast-push', {
        body: { title, body },
      });

      if (error) throw error;

      Alert.alert(
        'Success',
        `Notification Sent Successfully to ${data?.devices_targeted || 'all'} users!`
      );
      setTitle('');
      setBody('');
    } catch (err: any) {
      console.error('Push error:', err);
      Alert.alert('Error', err.message || 'Failed to send notification');
    } finally {
      setLoading(false);
    }
  };

  const applyPreset = (preset: typeof PRESETS[0]) => {
    setTitle(preset.title);
    setBody(preset.body);
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Push Notifications',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: Platform.OS === 'ios' ? 0 : 8 }}>
              <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
            </TouchableOpacity>
          ),
          headerStyle: { backgroundColor: '#F8F9FA' },
          headerShadowVisible: false,
        }}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.headerTitle}>Send Custom Push Notification</Text>
          <Text style={styles.headerSubtitle}>
            Reach all users with a custom message.
          </Text>

          <View style={styles.presetsContainer}>
            <Text style={styles.presetsLabel}>Quick Actions:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll} contentContainerStyle={{ paddingRight: 20 }}>
              {PRESETS.map((preset, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.chip}
                  onPress={() => applyPreset(preset)}
                >
                  <Text style={styles.chipText}>{preset.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Title</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 20% Qiimo Dhimis Maanta! 🍔"
              value={title}
              onChangeText={setTitle}
              placeholderTextColor="#999"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Message Body</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="e.g. Geli koodhka PUNTEATS20 marka aad amrayso Pizza ama Burger."
              value={body}
              onChangeText={setBody}
              multiline
              textAlignVertical="top"
              placeholderTextColor="#999"
            />
          </View>

          <TouchableOpacity
            style={[styles.sendButton, loading && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.sendButtonText}>Send to All Customers 🚀</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  scrollContent: {
    padding: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 15,
    color: '#6B6B6B',
    marginBottom: 24,
  },
  presetsContainer: {
    marginBottom: 24,
  },
  presetsLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  chipsScroll: {
    flexDirection: 'row',
  },
  chip: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  chipText: {
    color: '#1B7D3C',
    fontSize: 14,
    fontWeight: '600',
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1A1A1A',
  },
  textArea: {
    height: 120,
  },
  sendButton: {
    backgroundColor: '#1B7D3C',
    borderRadius: 25,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    shadowColor: '#1B7D3C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  sendButtonDisabled: {
    backgroundColor: '#8DC5A1',
    shadowOpacity: 0,
    elevation: 0,
  },
  sendButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
