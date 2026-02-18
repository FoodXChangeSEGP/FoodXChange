import React, { useEffect } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMyListStore, MyListItem } from '@/store';
import {
  colors,
  spacing,
  typography,
  borderRadius,
  shadows,
} from '@/theme';

/*interface MyListItem {
  id: number;
  product: {
    id: number;
    name: string;
    nutri_score: string;
    nova_score: number;
  };
  quantity: number;
}*/


export const MyListScreen: React.FC = () => {
  const { items, loading, fetchMyList, removeItem } = useMyListStore();

  useEffect(() => {
    fetchMyList();
  }, [fetchMyList]);

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary.dark} />
        <Text style={styles.loadingText}>Loading My List…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My List</Text>
          <Text style={styles.headerSubtitle}>
            Products saved for later comparison
          </Text>
        </View>

        {items.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="basket-outline" size={40} color={colors.neutral.lightGray} />
            <Text style={styles.emptyText}>Your list is empty</Text>
          </View>
        ) : (
          <FlatList<MyListItem>
            data={items}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={{ gap: spacing.md }}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <View style={styles.cardRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.productName}>
                      {item.name ?? 'Unknown Product'}
                    </Text>

                    <Text style={styles.metaText}>
                      Quantity: {item.quantity}
                    </Text>

                  </View>

                  <Pressable
                    style={styles.removeButton}
                    onPress={() => removeItem(item.barcode)}
                  >
                    <Ionicons name="trash-outline" size={18} color={colors.neutral.white} />
                  </Pressable>
                </View>
              </View>
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.offWhite,
  },

  content: {
    padding: spacing.base,
    paddingBottom: spacing['3xl'],
  },

  header: {
    marginBottom: spacing.lg,
  },

  headerTitle: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.primary.dark,
  },

  headerSubtitle: {
    fontSize: typography.fontSize.base,
    color: colors.neutral.darkGray,
    marginTop: spacing.xs,
  },

  card: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    ...shadows.md,
  },

  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },

  productName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary.dark,
  },

  metaText: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral.darkGray,
    marginTop: spacing.xs,
  },

  removeButton: {
    backgroundColor: colors.nutriScore.E,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
  },

  emptyState: {
    marginTop: spacing['2xl'],
    alignItems: 'center',
    gap: spacing.sm,
  },

  emptyText: {
    fontSize: typography.fontSize.base,
    color: colors.neutral.darkGray,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.neutral.offWhite,
  },

  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.sm,
    color: colors.neutral.darkGray,
  },
});

export default MyListScreen;
