/**
 * AnimatedPressable — scale-down spring micro-interaction on press.
 * Drop-in replacement for TouchableOpacity with a snappier feel.
 */

import React from 'react';
import { Pressable, ViewStyle, StyleProp } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';

const AnimatedPress = Animated.createAnimatedComponent(Pressable);

const SPRING_CONFIG = { damping: 15, stiffness: 300 };

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
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPress
      onPressIn={() => { scale.value = withSpring(0.97, SPRING_CONFIG); }}
      onPressOut={() => { scale.value = withSpring(1, SPRING_CONFIG); }}
      onPress={onPress}
      disabled={disabled}
      style={[animatedStyle, style]}
    >
      {children}
    </AnimatedPress>
  );
};

export default AnimatedPressable;
