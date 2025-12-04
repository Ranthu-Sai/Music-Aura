// Test YouTube API connectivity
// Add this to your app to debug network issues

import React, { useState } from 'react';
import { View, Text, Button, ScrollView } from 'react-native';
import axios from 'axios';

export default function NetworkTest() {
  const [results, setResults] = useState([]);

  const testInstance = async (url) => {
    const testUrl = `${url}/api/v1/search?q=test&type=video`;
    try {
          const response = await axios.get(testUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0',
        },
      });
      
      const status = response.status;
      const count = response.data?.length || 0;
      
      setResults(prev => [...prev, {
        url,
        status: 'SUCCESS',
        message: `${status} - ${count} results`,
      }]);
      
        } catch (error) {
      setResults(prev => [...prev, {
        url,
        status: 'FAILED',
        message: error.message,
      }]);
      
        }
  };

  const runTests = async () => {
    setResults([]);
    const instances = [
      'https://yt.omada.cafe',
      'https://y.com.sb',
      'https://inv.perditum.com',
    ];
    
    for (const instance of instances) {
      await testInstance(instance);
    }
  };

  return (
    <View style={{ padding: 20 }}>
      <Button title="Test YouTube APIs" onPress={runTests} />
      <ScrollView style={{ marginTop: 20 }}>
        {results.map((result, index) => (
          <View key={index} style={{ marginBottom: 10, padding: 10, backgroundColor: result.status === 'SUCCESS' ? '#dfd' : '#fdd' }}>
            <Text style={{ fontWeight: 'bold' }}>{result.url}</Text>
            <Text>{result.status}: {result.message}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

