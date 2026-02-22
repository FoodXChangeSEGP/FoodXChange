import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/theme';
import { typography, glassShadows, borderRadius, spacing } from '@/theme';

interface PriceTagProps {
  price: string | number;
  currency?: string;
  retailer?: string;
  isCheapest?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_MAP = {
  sm: { price: 14, currency: 12, retailer: 10 },
  md: { price: 18, currency: 14, retailer: 11 },
  lg: { price: 24, currency: 18, retailer: 12 },
};

export const PriceTag: React.FC<PriceTagProps> = ({
  price,
  currency = '\u00A3',
  retailer,
  isCheapest = false,
  size = 'md',
}) => {
  const { colors } = useTheme();
  const dims = SIZE_MAP[size];

  const priceStr = typeof price === 'number' ? price.toFixed(2) : price;

  return (
    <View style={[
      styles.container,
      isCheapest && {
        ...glassShadows.glow,
        shadowOpacity: 0.2,
      },
    ]}>
      <View style={styles.priceRow}>
        <Text style={[
          styles.currency,
          {
            fontSize: dims.currency,
            color: isCheapest ? colors.primary.main : colors.neutral.charcoal,
          },
        ]}>
          {currency}
        </Text>
        <Text style={[
          styles.price,
          {
            fontSize: dims.price,
            color: isCheapest ? colors.primary.main : colors.neutral.charcoal,
          },
        ]}>
          {priceStr}
        </Text>
      </View>
      {retailer && (
        <Text style={[styles.retailer, { fontSize: dims.retailer, color: colors.neutral.gray }]}>
          {retailer}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'flex-start',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  currency: {
    fontWeight: '400',
  },
  price: {
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  retailer: {
    marginTop: 1,
    fontWeight: '500',
  },
});

export default PriceTag;
