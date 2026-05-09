import React from 'react';
import { StyleSheet, Text as RNText, type TextProps, type TextStyle } from 'react-native';

import { Poppins } from '@/constants/theme';

const poppinsByWeight: Record<string, string> = {
  normal: Poppins.regular,
  bold: Poppins.bold,
  '100': Poppins.regular,
  '200': Poppins.regular,
  '300': Poppins.regular,
  '400': Poppins.regular,
  '500': Poppins.semiBold,
  '600': Poppins.semiBold,
  '700': Poppins.bold,
  '800': Poppins.extraBold,
  '900': Poppins.black,
};

function resolvePoppinsFont(fontWeight?: TextStyle['fontWeight']) {
  if (!fontWeight) return poppinsByWeight.normal;
  const weightKey = typeof fontWeight === 'number' ? `${fontWeight}` : fontWeight;
  return poppinsByWeight[weightKey] ?? poppinsByWeight.normal;
}

export function AppText({ style, ...rest }: TextProps) {
  const flattened = StyleSheet.flatten(style) as TextStyle | undefined;
  const fontFamily = flattened?.fontFamily;
  const fontWeight = flattened?.fontWeight;
  const resolvedFontFamily = fontFamily ?? resolvePoppinsFont(fontWeight);

  return (
    <RNText
      style={fontFamily ? style : [{ fontFamily: resolvedFontFamily }, style]}
      {...rest}
    />
  );
}

export const Text = AppText;
