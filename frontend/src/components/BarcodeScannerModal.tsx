import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Platform,
  TextInput,
  ActivityIndicator,
  Dimensions,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { useTheme, spacing, borderRadius, typography } from '@/theme';
import { AnimatedPressable, GradientButton } from './ui';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SCAN_AREA_SIZE = SCREEN_WIDTH * 0.7;

interface BarcodeScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onBarcodeScanned: (barcode: string) => void;
  isLoading?: boolean;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  visible,
  onClose,
  onBarcodeScanned,
  isLoading = false,
}) => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualBarcode, setManualBarcode] = useState('');
  const [scanned, setScanned] = useState(false);
  const scanLineAnim = useRef(new Animated.Value(0)).current;

  // Animate the scan line
  useEffect(() => {
    if (visible && !showManualEntry && permission?.granted) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(scanLineAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(scanLineAnim, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: true,
          }),
        ]),
      );
      animation.start();
      return () => animation.stop();
    }
  }, [visible, showManualEntry, permission?.granted, scanLineAnim]);

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setScanned(false);
      setManualBarcode('');
      setShowManualEntry(false);
    }
  }, [visible]);

  const handleBarcodeScanned = useCallback(
    (result: BarcodeScanningResult) => {
      if (scanned || isLoading) return;
      setScanned(true);
      onBarcodeScanned(result.data);
    },
    [scanned, isLoading, onBarcodeScanned],
  );

  const handleManualSubmit = useCallback(() => {
    const trimmed = manualBarcode.trim();
    if (!trimmed) return;
    onBarcodeScanned(trimmed);
  }, [manualBarcode, onBarcodeScanned]);

  const handleRetry = useCallback(() => {
    setScanned(false);
  }, []);

  const renderPermissionRequest = () => (
    <View style={[styles.centeredContent, { backgroundColor: colors.surface.background }]}>
      <Ionicons name="camera-outline" size={64} color={colors.neutral.gray} />
      <Text style={[styles.permissionTitle, { color: colors.neutral.charcoal }]}>
        Camera Access Required
      </Text>
      <Text style={[styles.permissionText, { color: colors.neutral.darkGray }]}>
        To scan barcodes, please allow camera access.
      </Text>
      <View style={{ marginTop: spacing.lg, width: '80%' }}>
        <GradientButton title="Allow Camera Access" onPress={requestPermission} />
      </View>
      <AnimatedPressable
        onPress={() => setShowManualEntry(true)}
        style={{ marginTop: spacing.md }}
      >
        <Text style={[styles.linkText, { color: colors.primary.main }]}>
          Enter barcode manually instead
        </Text>
      </AnimatedPressable>
    </View>
  );

  const renderManualEntry = () => (
    <View style={[styles.centeredContent, { backgroundColor: colors.surface.background }]}>
      <Ionicons name="barcode-outline" size={64} color={colors.primary.main} />
      <Text style={[styles.permissionTitle, { color: colors.neutral.charcoal }]}>
        Enter Barcode
      </Text>
      <Text style={[styles.permissionText, { color: colors.neutral.darkGray }]}>
        Type or paste the barcode number from the product packaging.
      </Text>
      <View style={styles.manualInputContainer}>
        <TextInput
          value={manualBarcode}
          onChangeText={setManualBarcode}
          onSubmitEditing={handleManualSubmit}
          placeholder="e.g. 5000128065253"
          placeholderTextColor={colors.neutral.gray}
          keyboardType="number-pad"
          returnKeyType="search"
          autoFocus
          style={[
            styles.manualInput,
            {
              color: colors.neutral.charcoal,
              backgroundColor: isDark ? 'rgba(30, 41, 59, 0.5)' : 'rgba(255, 255, 255, 0.8)',
              borderColor: colors.surface.glassBorder,
            },
          ]}
        />
        <View style={{ width: '80%', marginTop: spacing.md }}>
          <GradientButton
            title={isLoading ? 'Looking up...' : 'Search Barcode'}
            onPress={handleManualSubmit}
            disabled={!manualBarcode.trim() || isLoading}
          />
        </View>
      </View>
      {!permission?.granted ? null : (
        <AnimatedPressable
          onPress={() => {
            setShowManualEntry(false);
            setScanned(false);
          }}
          style={{ marginTop: spacing.md }}
        >
          <Text style={[styles.linkText, { color: colors.primary.main }]}>
            Use camera scanner instead
          </Text>
        </AnimatedPressable>
      )}
    </View>
  );

  const renderScanner = () => (
    <View style={styles.scannerContainer}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: [
            'ean13',
            'ean8',
            'upc_a',
            'upc_e',
            'code128',
            'code39',
            'code93',
          ],
        }}
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
      />

      {/* Overlay */}
      <View style={styles.overlay}>
        {/* Top overlay */}
        <View style={[styles.overlaySection, styles.overlayTop]} />
        {/* Middle row */}
        <View style={styles.overlayMiddle}>
          <View style={styles.overlaySide} />
          {/* Scan area (transparent) */}
          <View style={styles.scanArea}>
            {/* Corner markers */}
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
            {/* Animated scan line */}
            <Animated.View
              style={[
                styles.scanLine,
                {
                  transform: [
                    {
                      translateY: scanLineAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, SCAN_AREA_SIZE - 4],
                      }),
                    },
                  ],
                },
              ]}
            />
          </View>
          <View style={styles.overlaySide} />
        </View>
        {/* Bottom overlay */}
        <View style={[styles.overlaySection, styles.overlayBottom]}>
          <Text style={styles.instructionText}>
            {scanned
              ? isLoading
                ? 'Looking up product...'
                : 'Barcode detected!'
              : 'Point your camera at a barcode'}
          </Text>
          {scanned && !isLoading && (
            <AnimatedPressable onPress={handleRetry} style={{ marginTop: spacing.sm }}>
              <Text style={[styles.linkText, { color: '#FFFFFF' }]}>Scan again</Text>
            </AnimatedPressable>
          )}
        </View>
      </View>

      {/* Loading overlay */}
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.loadingText}>Looking up product...</Text>
        </View>
      )}
    </View>
  );

  const renderContent = () => {
    if (showManualEntry) return renderManualEntry();
    if (!permission) return <ActivityIndicator size="large" color={colors.primary.main} />;
    if (!permission.granted) return renderPermissionRequest();
    return renderScanner();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {renderContent()}

        {/* Header controls (floating) */}
        <View style={[styles.headerControls, { top: insets.top + spacing.sm }]}>
          <AnimatedPressable onPress={onClose} style={styles.headerButton}>
            <View style={styles.headerButtonCircle}>
              <Ionicons name="close" size={22} color="#FFFFFF" />
            </View>
          </AnimatedPressable>

          {!showManualEntry && permission?.granted && (
            <AnimatedPressable
              onPress={() => setShowManualEntry(true)}
              style={styles.headerButton}
            >
              <View style={styles.headerButtonCircle}>
                <Ionicons name="keypad-outline" size={20} color="#FFFFFF" />
              </View>
            </AnimatedPressable>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  headerControls: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  headerButton: {
    padding: spacing.xs,
  },
  headerButtonCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centeredContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  permissionTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: '600',
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  permissionText: {
    fontSize: typography.fontSize.md,
    marginTop: spacing.sm,
    textAlign: 'center',
    lineHeight: 22,
  },
  linkText: {
    fontSize: typography.fontSize.md,
    fontWeight: '500',
  },
  manualInputContainer: {
    width: '100%',
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  manualInput: {
    width: '80%',
    height: 56,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    fontSize: typography.fontSize.lg,
    textAlign: 'center',
    letterSpacing: 2,
  },
  scannerContainer: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  overlaySection: {
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  overlayTop: {
    flex: 1,
  },
  overlayMiddle: {
    flexDirection: 'row',
    height: SCAN_AREA_SIZE,
  },
  overlaySide: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  scanArea: {
    width: SCAN_AREA_SIZE,
    height: SCAN_AREA_SIZE,
    position: 'relative',
  },
  overlayBottom: {
    flex: 1,
    alignItems: 'center',
    paddingTop: spacing.xl,
  },
  instructionText: {
    color: '#FFFFFF',
    fontSize: typography.fontSize.md,
    fontWeight: '500',
    textAlign: 'center',
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#22C55E',
    borderWidth: 3,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderBottomWidth: 0,
    borderRightWidth: 0,
    borderTopLeftRadius: 8,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderBottomWidth: 0,
    borderLeftWidth: 0,
    borderTopRightRadius: 8,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderTopWidth: 0,
    borderRightWidth: 0,
    borderBottomLeftRadius: 8,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderBottomRightRadius: 8,
  },
  scanLine: {
    position: 'absolute',
    left: 8,
    right: 8,
    height: 2,
    backgroundColor: '#22C55E',
    borderRadius: 1,
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: typography.fontSize.md,
    fontWeight: '500',
    marginTop: spacing.md,
  },
});

export default BarcodeScannerModal;
