/**
 * TraceStatsPanel - Displays Phoenix trace statistics in the UI
 * 
 * Add this to your screens folder and import into HomeScreen
 */
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { subscribeToStats, getTraceStats, TraceStats } from '../services/phoenix';

export function TraceStatsPanel() {
  const [stats, setStats] = useState<TraceStats>(getTraceStats());

  useEffect(() => {
    // Subscribe to real-time stats updates
    const unsubscribe = subscribeToStats((newStats) => {
      setStats(newStats);
    });

    return () => unsubscribe();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>📊 Arize Phoenix Traces</Text>
      
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{stats.totalTraces}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{stats.visionTraces}</Text>
          <Text style={styles.statLabel}>Vision</Text>
        </View>
        
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{stats.ttsTraces}</Text>
          <Text style={styles.statLabel}>TTS</Text>
        </View>
        
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{stats.errorCount}</Text>
          <Text style={styles.statLabel}>Errors</Text>
        </View>
      </View>

      <View style={styles.latencyRow}>
        <Text style={styles.latencyText}>
          ⚡ Vision: {stats.avgVisionLatency || '--'}ms avg
        </Text>
        <Text style={styles.latencyText}>
          🔊 TTS: {stats.avgTTSLatency || '--'}ms avg
        </Text>
      </View>

      <Text style={styles.lastUpdate}>
        Last trace: {stats.lastTraceTime}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderRadius: 12,
    padding: 12,
    margin: 10,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  title: {
    color: '#a5b4fc',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  statBox: {
    alignItems: 'center',
  },
  statNumber: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  statLabel: {
    color: '#94a3b8',
    fontSize: 11,
    textTransform: 'uppercase',
  },
  latencyRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 4,
  },
  latencyText: {
    color: '#cbd5e1',
    fontSize: 12,
  },
  lastUpdate: {
    color: '#64748b',
    fontSize: 10,
    textAlign: 'center',
    marginTop: 8,
  },
});

export default TraceStatsPanel;
