import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { getClientId, canSubmit, submitMood, getLastSubmissionAt } from './MoodApi';

export const MockMood = () => {
  const [clientId, setClientId] = useState<string | null>(null);
  const [eligible, setEligible] = useState<boolean | null>(null);
  const [nextAvailableAt, setNextAvailableAt] = useState<number | null>(null);
  const [value, setValue] = useState<number | null>(null);
  const [note, setNote] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string>('');

  useEffect(() => {
    (async () => {
      const id = await getClientId();
      setClientId(id);
      const res = await canSubmit(id);
      setEligible(res.eligible);
      setNextAvailableAt(res.nextAvailableAt ?? null);
    })();
  }, []);

  const onSubmit = async () => {
    if (!clientId || value == null) {
      setStatusMessage('Select a mood value (1-5) before submitting.');
      return;
    }
    const r = await submitMood(clientId, value, note);
    if (r.ok) {
      setStatusMessage('Mood submitted — thank you.');
      setEligible(false);
      setNextAvailableAt(r.submittedAt! + 7 * 24 * 60 * 60 * 1000);
    } else {
      const last = await getLastSubmissionAt(clientId);
      setStatusMessage('You must wait 7 days between submissions. Last submitted: ' + (last ? new Date(last).toLocaleString() : 'unknown'));
      setEligible(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Mood (mock)</Text>
      <Text style={styles.label}>Client: {clientId ?? 'loading...'}</Text>
      {eligible === null ? (
        <Text>Checking eligibility…</Text>
      ) : eligible ? (
        <View>
          <Text style={styles.label}>Select mood (1 = low, 5 = high)</Text>
          <View style={styles.row}>
            {[1,2,3,4,5].map((v) => (
              <TouchableOpacity key={v} style={[styles.pill, value===v && styles.pillActive]} onPress={()=>setValue(v)}>
                <Text style={styles.pillText}>{v}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput style={styles.input} placeholder="Optional note" value={note} onChangeText={setNote} />
          <TouchableOpacity style={styles.submit} onPress={onSubmit}>
            <Text style={styles.submitText}>Submit</Text>
          </TouchableOpacity>
          <Text style={styles.hint}>You may submit once every 7 days. This is a local mock; server integration required for persistence.</Text>
        </View>
      ) : (
        <View>
          <Text style={styles.label}>Not eligible yet.</Text>
          {nextAvailableAt ? <Text>Next available: {new Date(nextAvailableAt).toLocaleString()}</Text> : null}
        </View>
      )}
      {statusMessage ? <Text style={styles.status}>{statusMessage}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container:{flex:1,padding:12},
  title:{fontSize:18,fontWeight:'700',marginBottom:8},
  label:{fontSize:14,marginVertical:6},
  row:{flexDirection:'row',gap:8,marginBottom:8},
  pill:{padding:10,backgroundColor:'#eee',borderRadius:6,marginRight:8},
  pillActive:{backgroundColor:'#4f9',},
  pillText:{fontSize:16,fontWeight:'600'},
  input:{borderWidth:1,borderColor:'#ddd',padding:8,borderRadius:6,marginBottom:8},
  submit:{backgroundColor:'#06f',padding:10,borderRadius:6,alignItems:'center'},
  submitText:{color:'#fff',fontWeight:'700'},
  hint:{fontSize:12,color:'#666',marginTop:8},
  status:{marginTop:8,color:'#080'}
});

export default MockMood;
