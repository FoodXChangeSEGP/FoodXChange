import React, { useRef } from 'react';
import { Pressable, Animated, ViewStyle, StyleProp, StyleSheet } from 'react-native';

interface AnimatedPressableProps {
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
  disabled?: boolean;
}

// These go on Animated.View so it participates correctly in its parent's layout
const OUTER_KEYS = new Set<string>([
  'flex', 'flexGrow', 'flexShrink', 'flexBasis', 'alignSelf',
  'margin', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
  'marginHorizontal', 'marginVertical', 'marginStart', 'marginEnd',
]);

export const AnimatedPressable: React.FC<AnimatedPressableProps> = ({
  onPress,
  style,
  children,
  disabled,
}) => {
  const scale = useRef(new Animated.Value(1)).current;
  const animatedStyle = { transform: [{ scale }] };

  const flat = style ? (StyleSheet.flatten(style) as ViewStyle) : null;

  // Animated.View: only flex-positioning + margin keys (for parent layout)
  const outerStyle: ViewStyle = {};
  // Pressable: everything except margin (avoids double spacing)
  const pressableStyle: ViewStyle = {};

  if (flat) {
    for (const key of Object.keys(flat) as (keyof ViewStyle)[]) {
      if (OUTER_KEYS.has(key)) {
        (outerStyle as any)[key] = (flat as any)[key];
      }
      if (key !== 'margin' && key !== 'marginTop' && key !== 'marginRight' &&
          key !== 'marginBottom' && key !== 'marginLeft' &&
          key !== 'marginHorizontal' && key !== 'marginVertical' &&
          key !== 'marginStart' && key !== 'marginEnd') {
        (pressableStyle as any)[key] = (flat as any)[key];
      }
    }
  }

  return (
    <Animated.View style={[animatedStyle, outerStyle]}>
      <Pressable
        onPressIn={() => Animated.spring(scale, { toValue: 0.97, damping: 15, stiffness: 300, useNativeDriver: true }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, damping: 15, stiffness: 300, useNativeDriver: true }).start()}
        onPress={onPress}
        disabled={disabled}
        style={flat ? pressableStyle : undefined}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
};

export default AnimatedPressable;
