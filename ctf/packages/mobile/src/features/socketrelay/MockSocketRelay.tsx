import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput } from 'react-native';
import { listRequests, createRequest, claimRequest } from './SocketRelayApi';

export const MockSocketRelay = () => {
  const [requests, setRequests] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');

  useEffect(()=>{(async ()=>{ setRequests(await listRequests()); })();},[]);

  const onCreate = async ()=>{
    if(!title||!details) return;
    const r = await createRequest({ owner_user_id: 'local-user', title, details, is_public:true });
    setRequests(await listRequests());
    setTitle(''); setDetails('');
  };

  const onClaim = async (id:string)=>{
    await claimRequest(id, 'local-fulfiller');
    setRequests(await listRequests());
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>SocketRelay (mock)</Text>
      <TextInput style={styles.input} placeholder="Title" value={title} onChangeText={setTitle} />
      <TextInput style={styles.input} placeholder="Details" value={details} onChangeText={setDetails} />
      <TouchableOpacity style={styles.submit} onPress={onCreate}><Text style={styles.submitText}>Create Request</Text></TouchableOpacity>
      <FlatList data={requests} keyExtractor={r=>r.id} renderItem={({item})=> (
        <View style={styles.row}>
          <View style={{flex:1}}>
            <Text style={styles.reqTitle}>{item.title}</Text>
            <Text style={styles.reqDetails}>{item.details}</Text>
            <Text style={styles.reqMeta}>Status: {item.status}</Text>
          </View>
          {item.status==='open' ? <TouchableOpacity style={styles.claim} onPress={()=>onClaim(item.id)}><Text style={styles.claimText}>Claim</Text></TouchableOpacity> : <Text style={styles.claimText}>Claimed</Text>}
        </View>
      )} />
    </View>
  );
};

const styles = StyleSheet.create({container:{flex:1,padding:12},title:{fontSize:18,fontWeight:'700',marginBottom:8},input:{borderWidth:1,borderColor:'#ddd',padding:8,borderRadius:6,marginBottom:8},submit:{backgroundColor:'#06f',padding:10,borderRadius:6,alignItems:'center',marginBottom:8},submitText:{color:'#fff',fontWeight:'700'},row:{flexDirection:'row',padding:8,backgroundColor:'#fafafa',borderRadius:6,marginBottom:8},reqTitle:{fontWeight:'700'},reqDetails:{color:'#333'},reqMeta:{fontSize:12,color:'#666'},claim:{backgroundColor:'#0a0',padding:8,borderRadius:6,alignSelf:'center'},claimText:{color:'#fff',fontWeight:'700'}});

export default MockSocketRelay;
