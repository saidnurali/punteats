import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Message {
  id: string;
  content: string;
  sender: "user" | "agent";
  created_at: string;
  read?: boolean;
}

// ─── Initial greeting from agent ─────────────────────────────────────────────
const INITIAL_MESSAGES: Message[] = [
  {
    id: "init-1",
    content: "Hello, good morning 👋",
    sender: "agent",
    created_at: new Date(Date.now() - 60000 * 3).toISOString(),
    read: true,
  },
  {
    id: "init-2",
    content: "I am a Customer Service, is there anything I can help you with? 😊",
    sender: "agent",
    created_at: new Date(Date.now() - 60000 * 2).toISOString(),
    read: true,
  },
];

function formatTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours().toString().padStart(2, "0");
  const m = d.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

// ─── Bubble Components ────────────────────────────────────────────────────────
const AgentBubble = ({ msg }: { msg: Message }) => (
  <View style={styles.agentRow}>
    <View style={styles.agentAvatar}>
      <Ionicons name="headset" size={16} color="#1B7D3C" />
    </View>
    <View style={styles.agentBubble}>
      <Text style={styles.agentText}>{msg.content}</Text>
      <Text style={styles.bubbleTime}>{formatTime(msg.created_at)}</Text>
    </View>
  </View>
);

const UserBubble = ({ msg }: { msg: Message }) => (
  <View style={styles.userRow}>
    <View style={styles.userBubble}>
      <Text style={styles.userText}>{msg.content}</Text>
      <View style={styles.userBubbleFooter}>
        <Text style={styles.userTime}>{formatTime(msg.created_at)}</Text>
        <Ionicons
          name={msg.read ? "checkmark-done" : "checkmark"}
          size={14}
          color={msg.read ? "#93C5FD" : "#D1FAE5"}
          style={{ marginLeft: 4 }}
        />
      </View>
    </View>
  </View>
);

// ─── Date Divider ─────────────────────────────────────────────────────────────
const DateDivider = ({ label }: { label: string }) => (
  <View style={styles.dateDivider}>
    <View style={styles.dateDividerLine} />
    <Text style={styles.dateDividerText}>{label}</Text>
    <View style={styles.dateDividerLine} />
  </View>
);

// ─── Main Chat Screen ─────────────────────────────────────────────────────────
export default function CustomerServiceChatScreen() {
  const router = useRouter();
  const flatRef = useRef<FlatList>(null);

  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [inputText, setInputText] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  // Load user id from session
  useEffect(() => {
    AsyncStorage.getItem("puntgo_user_session").then(raw => {
      if (raw) {
        const s = JSON.parse(raw);
        if (s.id) setUserId(s.id);
      }
    });
  }, []);

  // Load message history + realtime subscription
  useEffect(() => {
    if (!userId) return;

    // Fetch history
    supabase
      .from("support_messages")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (data && data.length > 0) {
          const mapped: Message[] = data.map((m: any) => ({
            id: String(m.id),
            content: m.content,
            sender: m.sender as "user" | "agent",
            created_at: m.created_at,
            read: m.read ?? false,
          }));
          setMessages([...INITIAL_MESSAGES, ...mapped]);
        }
      })
      .catch(() => {});

    // Realtime subscription for agent replies
    const channel = supabase
      .channel(`support_${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_messages",
          filter: `user_id=eq.${userId}`,
        },
        payload => {
          const m = payload.new as any;
          if (m.sender === "agent") {
            setMessages(prev => [
              ...prev,
              {
                id: String(m.id),
                content: m.content,
                sender: "agent",
                created_at: m.created_at,
                read: false,
              },
            ]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  const sendMessage = async () => {
    const text = inputText.trim();
    if (!text || isSending) return;

    setInputText("");
    const tempId = `temp-${Date.now()}`;
    const newMsg: Message = {
      id: tempId,
      content: text,
      sender: "user",
      created_at: new Date().toISOString(),
      read: false,
    };
    setMessages(prev => [...prev, newMsg]);

    if (!userId) return;

    setIsSending(true);
    try {
      await supabase.from("support_messages").insert([{
        user_id: userId,
        content: text,
        sender: "user",
        read: false,
      }]);
    } catch (_) {
    } finally {
      setIsSending(false);
    }
  };

  const renderItem = ({ item, index }: { item: Message; index: number }) => {
    const showDate =
      index === 0 ||
      new Date(item.created_at).toDateString() !==
        new Date(messages[index - 1]?.created_at).toDateString();

    return (
      <>
        {showDate && (
          <DateDivider
            label={
              new Date(item.created_at).toDateString() === new Date().toDateString()
                ? "Today"
                : new Date(item.created_at).toLocaleDateString()
            }
          />
        )}
        {item.sender === "agent" ? (
          <AgentBubble msg={item} />
        ) : (
          <UserBubble msg={item} />
        )}
      </>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={22} color="#1A1A1A" />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <View style={styles.agentAvatarLarge}>
            <Ionicons name="headset" size={20} color="#1B7D3C" />
          </View>
          <View>
            <Text style={styles.headerTitle}>Customer Service</Text>
            <View style={styles.onlineRow}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlineText}>Online</Text>
            </View>
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => Linking.openURL("tel:+252907123456").catch(() => {})}
          >
            <Ionicons name="call-outline" size={20} color="#1A1A1A" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn}>
            <Ionicons name="ellipsis-horizontal-circle-outline" size={22} color="#1A1A1A" />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Message List ── */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatRef}
          data={messages}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.chatContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: true })}
        />

        {/* ── Input Bar ── */}
        <View style={styles.inputBar}>
          <TouchableOpacity style={styles.inputSideBtn}>
            <Ionicons name="happy-outline" size={24} color="#9CA3AF" />
          </TouchableOpacity>

          <TextInput
            style={styles.textInput}
            placeholder="Type a message..."
            placeholderTextColor="#9CA3AF"
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={sendMessage}
          />

          <TouchableOpacity style={styles.inputSideBtn}>
            <Ionicons name="attach-outline" size={24} color="#9CA3AF" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.sendBtn, inputText.trim() ? styles.sendBtnActive : {}]}
            activeOpacity={0.8}
            onPress={inputText.trim() ? sendMessage : undefined}
          >
            <Ionicons
              name={inputText.trim() ? "send" : "mic"}
              size={20}
              color="#FFFFFF"
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F8F8" },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    gap: 10,
  },
  headerBtn: {
    width: 36, height: 36,
    borderRadius: 18,
    backgroundColor: "#F3F4F6",
    alignItems: "center", justifyContent: "center",
  },
  headerCenter: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  agentAvatarLarge: {
    width: 38, height: 38,
    borderRadius: 19,
    backgroundColor: "#E8F5EE",
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: { fontSize: 15, fontWeight: "700", color: "#1A1A1A" },
  onlineRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  onlineDot: {
    width: 7, height: 7,
    borderRadius: 4,
    backgroundColor: "#22C55E",
  },
  onlineText: { fontSize: 11, color: "#22C55E", fontWeight: "600" },

  // Chat
  chatContent: { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 14 },

  // Date Divider
  dateDivider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 16,
    gap: 10,
  },
  dateDividerLine: { flex: 1, height: 1, backgroundColor: "#E5E7EB" },
  dateDividerText: { fontSize: 12, color: "#9CA3AF", fontWeight: "500" },

  // Agent bubble
  agentRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 10,
    gap: 8,
  },
  agentAvatar: {
    width: 30, height: 30,
    borderRadius: 15,
    backgroundColor: "#E8F5EE",
    alignItems: "center", justifyContent: "center",
  },
  agentBubble: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: "75%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  agentText: { fontSize: 14, color: "#1A1A1A", lineHeight: 20 },
  bubbleTime: { fontSize: 10, color: "#9CA3AF", marginTop: 4, textAlign: "right" },

  // User bubble
  userRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 10,
  },
  userBubble: {
    backgroundColor: "#1B7D3C",
    borderRadius: 16,
    borderBottomRightRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: "75%",
  },
  userText: { fontSize: 14, color: "#FFFFFF", lineHeight: 20 },
  userBubbleFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: 4,
  },
  userTime: { fontSize: 10, color: "rgba(255,255,255,0.7)" },

  // Input Bar
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    gap: 6,
  },
  inputSideBtn: {
    width: 36, height: 36,
    alignItems: "center", justifyContent: "center",
  },
  textInput: {
    flex: 1,
    backgroundColor: "#F8F8F8",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 9 : 7,
    fontSize: 14,
    color: "#1A1A1A",
    maxHeight: 100,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  sendBtn: {
    width: 42, height: 42,
    borderRadius: 21,
    backgroundColor: "#9CA3AF",
    alignItems: "center", justifyContent: "center",
  },
  sendBtnActive: {
    backgroundColor: "#1B7D3C",
  },
});
