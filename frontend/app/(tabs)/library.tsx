import React, { useState } from 'react';
import { View, Pressable, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/app-text';
import { useAppTheme } from '@/src/theme/ThemeContext';
import { BookmarksTab } from '@/src/components/library/BookmarksTab';
import { HistoryTab } from '@/src/components/library/HistoryTab';

export default function LibraryScreen() {
  const { resolved } = useAppTheme();
  const isDark = resolved === 'dark';
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<'bookmarks' | 'history'>('bookmarks');

  const colors = React.useMemo(
    () => ({
      bg: isDark ? '#0B0B0E' : '#F6F1E9',
      card: isDark ? '#121218' : '#FBF6EE',
      text: isDark ? '#F2F2F7' : '#1E2329',
      subtext: isDark ? '#B3B3C2' : '#6A625A',
      border: isDark ? '#242434' : '#E6DED2',
      primary: isDark ? '#F2F2F7' : '#1E2329',
      primaryText: isDark ? '#0B0B0E' : '#F6F1E9',
    }),
    [isDark]
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
        <Text style={{ color: colors.text, fontWeight: '900', fontSize: 24, marginBottom: 16 }}>
          Library
        </Text>
        
        {/* Segmented Control */}
        <View style={{ 
          flexDirection: 'row', 
          backgroundColor: colors.card, 
          borderRadius: 12,
          padding: 4,
          borderWidth: 1,
          borderColor: colors.border
        }}>
          <Pressable
            onPress={() => setActiveTab('bookmarks')}
            style={{
              flex: 1,
              paddingVertical: 10,
              alignItems: 'center',
              backgroundColor: activeTab === 'bookmarks' ? colors.primary : 'transparent',
              borderRadius: 8,
            }}
          >
            <Text style={{ 
              fontWeight: '800', 
              color: activeTab === 'bookmarks' ? colors.primaryText : colors.subtext 
            }}>
              Bookmarks
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setActiveTab('history')}
            style={{
              flex: 1,
              paddingVertical: 10,
              alignItems: 'center',
              backgroundColor: activeTab === 'history' ? colors.primary : 'transparent',
              borderRadius: 8,
            }}
          >
            <Text style={{ 
              fontWeight: '800', 
              color: activeTab === 'history' ? colors.primaryText : colors.subtext 
            }}>
              History
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={{ flex: 1 }}>
        {activeTab === 'bookmarks' ? <BookmarksTab /> : <HistoryTab />}
      </View>
    </View>
  );
}
