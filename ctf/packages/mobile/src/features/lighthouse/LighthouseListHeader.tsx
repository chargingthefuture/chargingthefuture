import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const COLOR = '#EAB308';
const DARK = '#090B0F';

interface Props {
  total: number;
}

export const LighthouseListHeader: React.FC<Props> = ({ total }) => (
  <View style={styles.header}>
    <View style={styles.left}>
      <View style={styles.iconBox}>
        <Ionicons name="home" size={18} color={COLOR} />
      </View>
      <View>
        <Text style={styles.title}>LightHouse</Text>
        <Text style={styles.subtitle}>
          {total > 0 ? `${total.toLocaleString()} verified listings` : 'Safe & verified housing'}
        </Text>
      </View>
    </View>
  </View>
);

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    paddingBottom: 12,
    backgroundColor: DARK,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: `${COLOR}30`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: '#F9FAFB',
  },
  subtitle: {
    fontSize: 11,
    color: COLOR,
  },
});
