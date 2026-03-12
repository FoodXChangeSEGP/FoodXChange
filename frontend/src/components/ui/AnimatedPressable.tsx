import React, { useRef } from 'react';
import { Pressable, Animated, ViewStyle, StyleProp } from 'react-native';

interface AnimatedPressableProps {
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
  disabled?: boolean;
}

export const AnimatedPressable: React.FC<AnimatedPressableProps> = ({
  onPress,
  style,
  children,
  disabled,
}) => {
  const scale = useRef(new Animated.Value(1)).current;

  const animatedStyle = { transform: [{ scale }] };

  return (
    <Animated.View style={[animatedStyle, style as ViewStyle]}>
      <Pressable
        onPressIn={() => Animated.spring(scale, { toValue: 0.97, damping: 15, stiffness: 300, useNativeDriver: true }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, damping: 15, stiffness: 300, useNativeDriver: true }).start()}
        onPress={onPress}
        disabled={disabled}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
};

export default AnimatedPressable;
