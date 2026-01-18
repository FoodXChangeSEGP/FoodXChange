/**
 * SearchBar Component
 * Search input with barcode scan button
 */

import React from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography } from '@/theme';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit?: () => void;
  onBarcodeScan?: () => void;
  placeholder?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChangeText,
  onSubmit,
  onBarcodeScan,
  placeholder = 'Search products...',
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.inputContainer}>
        <Ionicons
          name="search"
          size={20}
          color={colors.neutral.gray}
          style={styles.searchIcon}
        />
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.neutral.gray}
          returnKeyType="search"
          onSubmitEditing={onSubmit}
        />
        {value.length > 0 && (
          <TouchableOpacity onPress={() => onChangeText('')}>
            <Ionicons name="close-circle" size={20} color={colors.neutral.gray} />
          </TouchableOpacity>
        )}
      </View>
      
      {onBarcodeScan && (
        <TouchableOpacity style={styles.barcodeButton} onPress={onBarcodeScan}>
          <Ionicons name="barcode-outline" size={24} color={colors.neutral.white} />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.base,
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.neutral.lightGray,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: typography.fontSize.base,
    color: colors.neutral.charcoal,
  },
  barcodeButton: {
    marginLeft: spacing.sm,
    backgroundColor: colors.primary.dark,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
  },
});

export default SearchBar;
