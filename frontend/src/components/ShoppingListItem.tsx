/**
 * ShoppingListItem Component
 * Displays a shopping list item with product, quantity, and price
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography } from '@/theme';
import type { ShoppingListItem as ShoppingListItemType } from '@/services/api';

interface ShoppingListItemProps {
  item: ShoppingListItemType;
  onToggleCheck?: (item: ShoppingListItemType) => void;
  onRemove?: (item: ShoppingListItemType) => void;
  onQuantityChange?: (item: ShoppingListItemType, quantity: number) => void;
}

export const ShoppingListItem: React.FC<ShoppingListItemProps> = ({
  item,
  onToggleCheck,
  onRemove,
  onQuantityChange,
}) => {
  return (
    <View style={[styles.container, item.is_checked && styles.containerChecked]}>
      {/* Checkbox */}
      <TouchableOpacity
        style={styles.checkbox}
        onPress={() => onToggleCheck?.(item)}
      >
        <Ionicons
          name={item.is_checked ? 'checkbox' : 'square-outline'}
          size={24}
          color={item.is_checked ? colors.primary.dark : colors.neutral.gray}
        />
      </TouchableOpacity>

      {/* Item Info */}
      <View style={styles.infoContainer}>
        <Text
          style={[styles.name, item.is_checked && styles.nameChecked]}
          numberOfLines={1}
        >
          {item.product.name}
        </Text>
        <Text style={styles.details}>
          {item.quantity} × {item.product.unit}
        </Text>
      </View>

      {/* Price */}
      <View style={styles.priceContainer}>
        {item.product.lowest_price && (
          <Text style={styles.price}>
            £{(parseFloat(item.product.lowest_price) * item.quantity).toFixed(2)}
          </Text>
        )}
      </View>

      {/* Remove Button */}
      {onRemove && (
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => onRemove(item)}
        >
          <Ionicons name="trash-outline" size={20} color={colors.semantic.error} />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.neutral.lightGray,
  },
  containerChecked: {
    backgroundColor: colors.neutral.offWhite,
    opacity: 0.7,
  },
  checkbox: {
    marginRight: spacing.md,
  },
  infoContainer: {
    flex: 1,
  },
  name: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.neutral.charcoal,
    marginBottom: spacing.xs,
  },
  nameChecked: {
    textDecorationLine: 'line-through',
    color: colors.neutral.gray,
  },
  details: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral.darkGray,
  },
  priceContainer: {
    marginRight: spacing.md,
  },
  price: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary.dark,
  },
  removeButton: {
    padding: spacing.xs,
  },
});

export default ShoppingListItem;
