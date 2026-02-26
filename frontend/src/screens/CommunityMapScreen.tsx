/**
 * CommunityMapScreen — native fallback (map requires web/browser)
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, textFont, typography, spacing } from '@/theme';

export const CommunityMapScreen: React.FC = () => {
  const { colors } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: colors.surface.background }]}>
      <Ionicons name="map-outline" size={48} color={colors.neutral.gray} />
      <Text style={[styles.text, { color: colors.neutral.darkGray }, textFont.medium]}>
        Map view is available on web
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  text: {
    fontSize: typography.fontSize.base,
  },
});

export default CommunityMapScreen;
