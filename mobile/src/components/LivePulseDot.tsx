/**
 * Animated Live Pulse Indicator Dot
 * Respects reduced-motion accessibility preference.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, AccessibilityInfo, ViewStyle } from 'react-native';

interface LivePulseDotProps {
  color?: string;
  size?: number;
  style?: ViewStyle;
}

export const LivePulseDot: React.FC<LivePulseDotProps> = ({
  color = '#DC2626',
  size = 7,
  style,
}) => {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null;
    let mounted = true;

    AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (!mounted || reduceMotion) return;

      animation = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(scale, {
              toValue: 1.35,
              duration: 900,
              useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: 0.45,
              duration: 900,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(scale, {
              toValue: 1,
              duration: 900,
              useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: 1,
              duration: 900,
              useNativeDriver: true,
            }),
          ]),
        ])
      );
      animation.start();
    });

    return () => {
      mounted = false;
      animation?.stop();
    };
  }, [scale, opacity]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          transform: [{ scale }],
          opacity,
        },
        style,
      ]}
    />
  );
};
