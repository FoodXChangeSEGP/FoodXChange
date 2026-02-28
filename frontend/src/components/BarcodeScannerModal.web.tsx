import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, spacing, borderRadius, typography } from '@/theme';
import { AnimatedPressable, GradientButton } from './ui';

interface BarcodeScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onBarcodeScanned: (barcode: string) => void;
  isLoading?: boolean;
}

/**
 * Web version of BarcodeScannerModal.
 * Uses <video> + BarcodeDetector API when available; otherwise manual entry only.
 */
export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  visible,
  onClose,
  onBarcodeScanned,
  isLoading = false,
}) => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [manualBarcode, setManualBarcode] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [hasBarcodeDetector, setHasBarcodeDetector] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectionRef = useRef<number | null>(null);
  const scannedRef = useRef(false);

  // Check for BarcodeDetector API
  useEffect(() => {
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      setHasBarcodeDetector(true);
    }
  }, []);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (visible) {
      setManualBarcode('');
      setCameraError(null);
      scannedRef.current = false;
    } else {
      stopCamera();
    }
  }, [visible]);

  const stopCamera = useCallback(() => {
    if (detectionRef.current) {
      cancelAnimationFrame(detectionRef.current);
      detectionRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);

      // Start barcode detection loop
      if ('BarcodeDetector' in window) {
        const detector = new (window as any).BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39'],
        });

        const detectLoop = async () => {
          if (!videoRef.current || scannedRef.current || !streamRef.current) return;
          try {
            const barcodes = await detector.detect(videoRef.current);
            if (barcodes.length > 0 && !scannedRef.current) {
              scannedRef.current = true;
              stopCamera();
              onBarcodeScanned(barcodes[0].rawValue);
              return;
            }
          } catch {
            // Detection frame error - continue
          }
          detectionRef.current = requestAnimationFrame(detectLoop);
        };
        detectionRef.current = requestAnimationFrame(detectLoop);
      }
    } catch (err: any) {
      setCameraError(
        err?.name === 'NotAllowedError'
          ? 'Camera access was denied. Please allow camera access in your browser settings.'
          : 'Could not access camera. Please enter the barcode manually.',
      );
    }
  }, [onBarcodeScanned, stopCamera]);

  const handleManualSubmit = useCallback(() => {
    const trimmed = manualBarcode.trim();
    if (!trimmed) return;
    onBarcodeScanned(trimmed);
  }, [manualBarcode, onBarcodeScanned]);

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent={false}>
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.surface.background,
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
          },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <AnimatedPressable onPress={onClose}>
            <Ionicons name="close" size={28} color={colors.neutral.charcoal} />
          </AnimatedPressable>
          <Text style={[styles.headerTitle, { color: colors.neutral.charcoal }]}>
            Barcode Scanner
          </Text>
          <View style={{ width: 28 }} />
        </View>

        <View style={styles.content}>
          {/* Camera section (web) */}
          {hasBarcodeDetector && (
            <View style={styles.cameraSection}>
              {cameraActive ? (
                <View style={styles.videoWrapper}>
                  {/* @ts-ignore - using HTML video element on web */}
                  <video
                    ref={videoRef as any}
                    style={{
                      width: '100%',
                      maxWidth: 480,
                      borderRadius: 12,
                      objectFit: 'cover',
                    }}
                    playsInline
                    muted
                    autoPlay
                  />
                  <View style={styles.cameraScanOverlay}>
                    <View style={styles.cameraScanFrame} />
                  </View>
                  <AnimatedPressable onPress={stopCamera} style={{ marginTop: spacing.sm }}>
                    <Text style={[styles.linkText, { color: colors.semantic.error }]}>
                      Stop Camera
                    </Text>
                  </AnimatedPressable>
                </View>
              ) : (
                <View style={{ alignItems: 'center' }}>
                  <GradientButton
                    title="Open Camera Scanner"
                    onPress={startCamera}
                    icon="camera-outline"
                  />
                  {cameraError && (
                    <Text style={[styles.errorText, { color: colors.semantic.error }]}>
                      {cameraError}
                    </Text>
                  )}
                </View>
              )}
            </View>
          )}

          {hasBarcodeDetector && (
            <View style={styles.dividerRow}>
              <View style={[styles.dividerLine, { backgroundColor: colors.neutral.lightGray }]} />
              <Text style={[styles.dividerText, { color: colors.neutral.gray }]}>or</Text>
              <View style={[styles.dividerLine, { backgroundColor: colors.neutral.lightGray }]} />
            </View>
          )}

          {/* Manual entry */}
          <View style={styles.manualSection}>
            <Ionicons
              name="barcode-outline"
              size={48}
              color={colors.primary.main}
              style={{ marginBottom: spacing.md }}
            />
            <Text style={[styles.sectionTitle, { color: colors.neutral.charcoal }]}>
              Enter Barcode Manually
            </Text>
            <Text style={[styles.sectionSubtext, { color: colors.neutral.darkGray }]}>
              Type the barcode number from the product packaging
            </Text>
            <TextInput
              value={manualBarcode}
              onChangeText={setManualBarcode}
              onSubmitEditing={handleManualSubmit}
              placeholder="e.g. 5000128065253"
              placeholderTextColor={colors.neutral.gray}
              returnKeyType="search"
              autoFocus={!hasBarcodeDetector}
              style={[
                styles.manualInput,
                {
                  color: colors.neutral.charcoal,
                  backgroundColor: isDark
                    ? 'rgba(30, 41, 59, 0.5)'
                    : 'rgba(255, 255, 255, 0.8)',
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

          {isLoading && (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={colors.primary.main} />
              <Text style={[styles.loadingText, { color: colors.neutral.darkGray }]}>
                Looking up product...
              </Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  cameraSection: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  videoWrapper: {
    alignItems: 'center',
    position: 'relative',
  },
  cameraScanOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraScanFrame: {
    width: 200,
    height: 200,
    borderWidth: 2,
    borderColor: '#22C55E',
    borderRadius: 12,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '80%',
    marginVertical: spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: spacing.md,
    fontSize: typography.fontSize.sm,
  },
  manualSection: {
    alignItems: 'center',
    width: '100%',
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  sectionSubtext: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  manualInput: {
    width: '80%',
    maxWidth: 360,
    height: 56,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    fontSize: typography.fontSize.lg,
    textAlign: 'center',
    letterSpacing: 2,
  },
  linkText: {
    fontSize: typography.fontSize.md,
    fontWeight: '500',
  },
  errorText: {
    fontSize: typography.fontSize.sm,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  loadingText: {
    fontSize: typography.fontSize.sm,
  },
});

export default BarcodeScannerModal;
