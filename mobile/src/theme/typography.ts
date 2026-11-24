/**
 * Typography Tokens
 * Dynamic Type & Screen Reader friendly scales.
 */
import { TextStyle } from 'react-native';

export const typography = {
  h1: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    letterSpacing: -0.5,
  } as TextStyle,
  h2: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    letterSpacing: -0.3,
  } as TextStyle,
  h3: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600',
    letterSpacing: -0.2,
  } as TextStyle,
  subtitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
  } as TextStyle,
  body: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '400',
  } as TextStyle,
  bodyMedium: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '500',
  } as TextStyle,
  bodyBold: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '600',
  } as TextStyle,
  callout: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
  } as TextStyle,
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
  } as TextStyle,
  captionMedium: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  } as TextStyle,
  badge: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  } as TextStyle,
  tabular: {
    fontVariant: ['tabular-nums'],
  } as TextStyle,
};
