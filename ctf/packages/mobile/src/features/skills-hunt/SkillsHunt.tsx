import React, { useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, TextInput, ScrollView } from 'react-native';

const ROUNDS = [
  { id: 1, title: 'Web Development Bootcamp', status: 'live', enrolled: 234, capacity: 300, weeks: 8, level: 'Beginner', facilitator: 'Lena H.', color: '#A855F7' },
  { id: 2, title: 'Trauma-Informed Care Training', status: 'live', enrolled: 189, capacity: 200, weeks: 6, level: 'Intermediate', facilitator: 'Maria G.', color: '#22C55E' },
  { id: 3, title: 'Financial Literacy Cohort', status: 'upcoming', enrolled: 0, capacity: 150, weeks: 4, level: 'Beginner', facilitator: 'DeShawn W.', color: '#F59E0B' },
  { id: 4, title: 'Legal Rights Navigator', status: 'upcoming', enrolled: 0, capacity: 100, weeks: 3, level: 'All Levels', facilitator: 'Priya S.', color: '#3B82F6' },
  { id: 5, title: 'Peer Leadership Program', status: 'completed', enrolled: 120, capacity: 120, weeks: 12, level: 'Advanced', facilitator: 'James T.', color: '#EC4899' },
];

const LEADERBOARD = [
  { rank: 1, name: 'Amara Okonkwo', points: 9840, badges: 14 },
  { rank: 2, name: 'Maria Gonzalez', points: 8723, badges: 12 },
  { rank: 3, name: 'Priya Sharma', points: 7891, badges: 11 },
  { rank: 4, name: 'You', points: 6412, badges: 9, isMe: true },
  { rank: 5, name: 'James Thibodeau', points: 5910, badges: 8 },
];


const CHAT = [
  { id: 1, from: 'hub', text: 'Skills Hunt matches you with learning cohorts based on your workforce gaps. 6 active rounds right now. Ready to level up?' },
  { id: 2, from: 'user', text: 'What rounds match my profile?' },
  { id: 3, from: 'hub', text: 'Based on your Workforce profile, Web Development (87% match) and Financial Literacy (74% match) are your top picks. Both are accepting applications.', action: 'Apply Now' },
];

export const SkillsHunt = () => {
  const [tab, setTab] = useState('rounds');
  const [input, setInput] = useState('');
  const [msgs, setMsgs] = useState(CHAT);
  const [joined, setJoined] = useState([]);

  const send = () => {
    if (!input.trim()) return;
    setMsgs([...msgs, { id: Date.now(), from: 'user', text: input }]);
    setInput('');
  };

  const renderRounds = () => (
    <FlatList
      data={ROUNDS}
      keyExtractor={item => item.id.toString()}
      ListEmptyComponent={<Text style={styles.empty}>No rounds available.</Text>}
      renderItem={({ item }) => (
        <View style={[styles.round, { borderLeftColor: item.color }] }>
          <Text style={styles.roundTitle}>{item.title}</Text>
          <Text>Status: {item.status}</Text>
          <Text>Enrolled: {item.enrolled}/{item.capacity}</Text>
          <Text>Weeks: {item.weeks}</Text>
          <Text>Level: {item.level}</Text>
          <Text>Facilitator: {item.facilitator}</Text>
          {item.status === 'live' && !joined.includes(item.id) && (
            <TouchableOpacity style={styles.joinBtn} onPress={() => setJoined([...joined, item.id])}>
              <Text style={styles.joinBtnText}>Join</Text>
            </TouchableOpacity>
          )}
          {joined.includes(item.id) && <Text style={styles.joined}>Joined</Text>}
        </View>
      )}
    />
  );

  const renderLeaderboard = () => (
    <FlatList
      data={LEADERBOARD}
      keyExtractor={item => item.rank.toString()}
      ListEmptyComponent={<Text style={styles.empty}>No leaderboard data.</Text>}
      renderItem={({ item }) => (
        <View style={styles.leaderRow}>
          <Text style={styles.leaderRank}>#{item.rank}</Text>
          <Text style={item.isMe ? styles.me : styles.leaderName}>{item.name}</Text>
          <Text>{item.points} pts</Text>
          <Text>🏅{item.badges}</Text>
        </View>
      )}
    />
  );

  const renderChat = () => (
    <View style={{flex:1}}>
      <ScrollView style={styles.chatArea}>
        {msgs.map(m => (
          <View style={m.from === 'user' ? styles.userMsg : styles.hubMsg}>
            <Text>{m.text}</Text>
            {m.action && <TouchableOpacity style={styles.actionBtn}><Text style={styles.actionBtnText}>{m.action}</Text></TouchableOpacity>}
          </View>
        ))}
      </ScrollView>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Type a message..."
        />
        <TouchableOpacity style={styles.sendBtn} onPress={send}>
          <Text style={styles.sendBtnText}>Send</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        <TouchableOpacity onPress={() => setTab('rounds')} style={[styles.tab, tab==='rounds'&&styles.activeTab]}><Text>Rounds</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => setTab('leaderboard')} style={[styles.tab, tab==='leaderboard'&&styles.activeTab]}><Text>Leaderboard</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => setTab('chat')} style={[styles.tab, tab==='chat'&&styles.activeTab]}><Text>Chat</Text></TouchableOpacity>
      </View>
      <View style={{flex:1}}>
        {tab==='rounds' && renderRounds()}
        {tab==='leaderboard' && renderLeaderboard()}
        {tab==='chat' && renderChat()}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12, backgroundColor: '#fff' },
  tabs: { flexDirection: 'row', marginBottom: 12 },
  tab: { flex: 1, alignItems: 'center', padding: 8, borderBottomWidth: 2, borderBottomColor: '#eee' },
  activeTab: { borderBottomColor: '#A855F7' },
  round: { borderLeftWidth: 4, padding: 12, marginBottom: 10, backgroundColor: '#f9f9f9', borderRadius: 8 },
  roundTitle: { fontWeight: '700', fontSize: 16, marginBottom: 4 },
  joinBtn: { marginTop: 8, backgroundColor: '#A855F7', padding: 8, borderRadius: 6 },
  joinBtnText: { color: '#fff', fontWeight: '700' },
  joined: { marginTop: 8, color: '#22C55E', fontWeight: '700' },
  leaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  leaderRank: { fontWeight: '700', width: 32 },
  leaderName: { flex: 1 },
  me: { flex: 1, color: '#A855F7', fontWeight: '700' },
  chatArea: { flex: 1, marginBottom: 8 },
  userMsg: { alignSelf: 'flex-end', backgroundColor: '#A855F7', color: '#fff', padding: 8, borderRadius: 8, marginBottom: 4 },
  hubMsg: { alignSelf: 'flex-start', backgroundColor: '#eee', padding: 8, borderRadius: 8, marginBottom: 4 },
  inputRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  input: { flex: 1, borderWidth: 1, borderColor: '#eee', borderRadius: 6, padding: 8, marginRight: 8 },
  sendBtn: { backgroundColor: '#A855F7', padding: 10, borderRadius: 6 },
  sendBtnText: { color: '#fff', fontWeight: '700' },
  actionBtn: { marginTop: 4, backgroundColor: '#22C55E', padding: 6, borderRadius: 6 },
  actionBtnText: { color: '#fff', fontWeight: '700' },
  empty: { textAlign: 'center', color: '#aaa', marginTop: 24 },
});
