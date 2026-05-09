import React from 'react';
import { View } from 'react-native';
import { Skeleton } from './Skeleton';
import { useAppTheme } from '@/src/theme/ThemeContext';

export const MangaListSkeleton = ({ count = 5 }: { count?: number }) => {
  const { resolved } = useAppTheme();
  const isDark = resolved === 'dark';
  const cardBg = isDark ? '#121218' : '#FBF6EE';
  const borderColor = isDark ? '#242434' : '#E6DED2';

  return (
    <View style={{ gap: 12, paddingBottom: 20 }}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={{
            flexDirection: 'row',
            backgroundColor: cardBg,
            borderWidth: 1,
            borderColor,
            borderRadius: 16,
            padding: 12,
            gap: 12,
          }}
        >
          <Skeleton width={72} height={96} borderRadius={14} />
          <View style={{ flex: 1, gap: 8, justifyContent: 'center' }}>
            <Skeleton width="90%" height={18} borderRadius={4} />
            <Skeleton width="60%" height={14} borderRadius={4} />
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
              <Skeleton width={60} height={24} borderRadius={12} />
              <Skeleton width={60} height={24} borderRadius={12} />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
};

export const MangaGridSkeleton = ({ count = 6, columns = 2 }: { count?: number; columns?: number }) => {
  const { resolved } = useAppTheme();
  const isDark = resolved === 'dark';
  const cardBg = isDark ? '#121218' : '#FBF6EE';
  const borderColor = isDark ? '#242434' : '#E6DED2';

  // Group into rows
  const rows = [];
  for (let i = 0; i < count; i += columns) {
    rows.push(Array.from({ length: Math.min(columns, count - i) }));
  }

  return (
    <View style={{ gap: 12, paddingBottom: 20 }}>
      {rows.map((row, rIdx) => (
        <View key={rIdx} style={{ flexDirection: 'row', gap: 8 }}>
          {row.map((_, cIdx) => (
            <View
              key={cIdx}
              style={{
                flex: 1,
                backgroundColor: cardBg,
                borderRadius: 12,
                borderWidth: 1,
                borderColor,
                overflow: 'hidden',
              }}
            >
              <Skeleton width="100%" height={undefined} style={{ aspectRatio: 2 / 3, borderRadius: 0 }} />
              <View style={{ padding: 8, gap: 6 }}>
                <Skeleton width="100%" height={14} borderRadius={4} />
                <Skeleton width="70%" height={14} borderRadius={4} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                  <Skeleton width={40} height={12} borderRadius={4} />
                  <Skeleton width={30} height={12} borderRadius={4} />
                </View>
              </View>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
};

export const HeroCarouselSkeleton = () => {
  const { resolved } = useAppTheme();
  const isDark = resolved === 'dark';
  const borderColor = isDark ? '#242434' : '#E6DED2';

  return (
    <View style={{ marginBottom: 24, paddingHorizontal: 16 }}>
      <View
        style={{
          width: '100%',
          height: 390,
          borderRadius: 24,
          borderWidth: 1,
          borderColor,
          overflow: 'hidden',
        }}
      >
        <Skeleton width="100%" height="100%" borderRadius={0} />
      </View>
    </View>
  );
};

export const RecommendedSkeleton = () => {
  return (
    <View style={{ paddingVertical: 12, paddingHorizontal: 12 }}>
      <Skeleton width={150} height={20} borderRadius={6} style={{ marginBottom: 12, marginLeft: 12 }} />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <View key={i}>
            <Skeleton width={96} height={128} borderRadius={14} />
            <Skeleton width={80} height={12} borderRadius={4} style={{ marginTop: 8 }} />
            <Skeleton width={60} height={12} borderRadius={4} style={{ marginTop: 4 }} />
          </View>
        ))}
      </View>
    </View>
  );
};
