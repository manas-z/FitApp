import { forwardRef, useState } from 'react';
import {
  StyleSheet,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
  StyleProp,
} from 'react-native';

import { palette, radii, spacing } from '@/constants/theme';
import { StyledText } from '../StyledText';

type TextFieldProps = TextInputProps & {
  label?: string;
  hint?: string;
  error?: string;
  containerStyle?: StyleProp<ViewStyle>;
};

export const TextField = forwardRef<TextInput, TextFieldProps>(
  ({ label, hint, error, style, containerStyle, editable = true, ...rest }, ref) => {
    const [focused, setFocused] = useState(false);
    const isDisabled = !editable;

    return (
      <View style={containerStyle}>
        {label ? (
          <StyledText variant="label" weight="semibold" tone="secondary">
            {label}
          </StyledText>
        ) : null}
        <View
          style={[
            styles.inputContainer,
            focused && styles.focused,
            error && styles.error,
            isDisabled && styles.disabled,
          ]}
        >
          <TextInput
            ref={ref}
            editable={editable}
            placeholderTextColor={palette.textMuted}
            style={[styles.input, style]}
            onFocus={(event) => {
              setFocused(true);
              rest.onFocus?.(event);
            }}
            onBlur={(event) => {
              setFocused(false);
              rest.onBlur?.(event);
            }}
            {...rest}
          />
        </View>
        {error ? (
          <StyledText variant="caption" tone="primary">
            {error}
          </StyledText>
        ) : hint ? (
          <StyledText variant="caption" tone="muted">
            {hint}
          </StyledText>
        ) : null}
      </View>
    );
  },
);

TextField.displayName = 'TextField';

const styles = StyleSheet.create({
  inputContainer: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radii.lg,
    backgroundColor: palette.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    marginTop: spacing.xs,
  },
  focused: {
    borderColor: palette.primary,
  },
  error: {
    borderColor: palette.danger,
  },
  disabled: {
    opacity: 0.5,
  },
  input: {
    fontSize: 16,
    color: palette.textPrimary,
  },
});
