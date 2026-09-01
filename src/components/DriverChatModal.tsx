import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Modal, 
  TouchableOpacity,
  TouchableWithoutFeedback,
  TextInput, 
  FlatList, 
  KeyboardAvoidingView, 
  Platform, 
  SafeAreaView,
  Keyboard,
  Vibration,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

interface Message {
  id: string;
  order_id: string;
  sender_role: 'customer' | 'driver' | 'admin';
  sender_name: string;
  text: string;
  created_at: string;
}

interface DriverChatModalProps {
  visible: boolean;
  onClose: () => void;
  orderId: string;
  customerName: string;
  driverName: string;
}

export default function DriverChatModal({ 
  visible, 
  onClose, 
  orderId, 
  customerName, 
  driverName 
}: DriverChatModalProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const flatListRef = useRef<FlatList>(null);

  // EFFECT 1: Fetch complete chat history from DB every time modal opens or orderId changes
  const fetchPermanentChatHistory = async () => {
    if (!orderId) return;

    const { data, error } = await supabase
      .from('order_messages')
      .select('*')
      .eq('order_id', String(orderId))
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error loading chat history from DB:', error);
    } else if (data) {
      setMessages(data as Message[]);
    }
  };

  useEffect(() => {
    if (orderId && visible) {
      fetchPermanentChatHistory();
    }
  }, [orderId, visible]);

  // EFFECT 2: Permanent realtime channel — keyed to orderId, never tears down until unmount
  useEffect(() => {
    if (!orderId) return;

    const channel = supabase
      .channel(`chat_permanent_${String(orderId)}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'order_messages',
          filter: `order_id=eq.${String(orderId)}`,
        },
        (payload) => {
          // console.log('⚡ New Realtime Message Received:', payload.new);
          // Subtle vibration for incoming driver/admin messages
          if (payload.new.sender_role !== 'customer') {
            Vibration.vibrate(80);
          }
          setMessages((prevMessages) => {
            if (prevMessages.some((msg) => msg.id === payload.new.id)) {
              return prevMessages;
            }
            return [...prevMessages, payload.new as Message];
          });
        }
      )
      .subscribe((status) => {
        // console.log('Realtime Chat Subscription Status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0 && flatListRef.current) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!inputText.trim()) return;

    const textToSend = inputText.trim();
    setInputText(''); // Clear input instantly

    const messagePayload = {
      order_id: String(orderId),
      sender_role: 'customer',
      sender_name: customerName || 'Customer',
      text: textToSend
    };

    const { data, error } = await supabase
      .from('order_messages')
      .insert([messagePayload])
      .select();
    
    if (error) {
      console.error('Failed to send message:', error);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMyMessage = item.sender_role === 'customer';
    
    return (
      <View style={[styles.messageBubbleContainer, isMyMessage ? styles.alignRight : styles.alignLeft]}>
        <View style={[styles.bubble, isMyMessage ? styles.customerBubble : styles.driverBubble]}>
          {!isMyMessage && (
            <Text style={styles.senderName}>{item.sender_name || 'Driver'}</Text>
          )}
          <Text style={isMyMessage ? styles.customerText : styles.driverText}>
            {item.text}
          </Text>
          <Text style={styles.timestamp}>
            {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView 
          style={styles.keyboardAvoidingView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={{ flex: 1, backgroundColor: '#F3F4F6' }}>
              {/* Header */}
              <View style={styles.header}>
                <View style={styles.headerTitleContainer}>
                  <View style={styles.avatar}>
                    <Ionicons name="person" size={16} color="#FFFFFF" />
                  </View>
                  <View>
                    <Text style={styles.headerTitle}>{driverName || 'Driver'}</Text>
                    <View style={styles.statusContainer}>
                      <View style={styles.statusDot} />
                      <Text style={styles.statusText}>Online • Assigned Driver</Text>
                    </View>
                  </View>
                </View>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <Ionicons name="close" size={24} color="#1A1A1A" />
                </TouchableOpacity>
              </View>

              {/* Chat List */}
              <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={item => item.id}
                renderItem={renderMessage}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Ionicons name="chatbubbles-outline" size={48} color="#D1D5DB" />
                    <Text style={styles.emptyText}>Send a message to your driver.</Text>
                  </View>
                }
              />

              {/* Input Area */}
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.textInput}
                  placeholder="Type a message..."
                  placeholderTextColor="#9CA3AF"
                  value={inputText}
                  onChangeText={setInputText}
                  multiline
                  maxLength={500}
                />
                <TouchableOpacity 
                  style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
                  onPress={sendMessage}
                  disabled={!inputText.trim()}
                >
                  <Ionicons name="send" size={18} color="#FFFFFF" style={{ marginLeft: 3 }} />
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6', // Light gray WhatsApp-like background
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1B7D3C',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  closeButton: {
    padding: 4,
  },
  listContent: {
    padding: 16,
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 60,
  },
  emptyText: {
    marginTop: 12,
    color: '#9CA3AF',
    fontSize: 14,
  },
  messageBubbleContainer: {
    width: '100%',
    marginBottom: 12,
  },
  alignRight: {
    alignItems: 'flex-end',
  },
  alignLeft: {
    alignItems: 'flex-start',
  },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  customerBubble: {
    backgroundColor: '#10B981',
    borderBottomRightRadius: 4,
  },
  driverBubble: {
    backgroundColor: '#E5E7EB',
    borderBottomLeftRadius: 4,
  },
  senderName: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
    marginBottom: 4,
  },
  customerText: {
    fontSize: 15,
    lineHeight: 20,
    color: '#FFFFFF',
  },
  driverText: {
    fontSize: 15,
    lineHeight: 20,
    color: '#111827',
  },
  timestamp: {
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
    color: '#9CA3AF',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 15,
    color: '#111827',
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#1B7D3C',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
    marginBottom: 2,
  },
  sendButtonDisabled: {
    backgroundColor: '#D1D5DB',
  }
});
