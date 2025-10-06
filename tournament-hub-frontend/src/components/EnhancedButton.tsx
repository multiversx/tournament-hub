import React from 'react';
import {
    Button as ChakraButton,
    ButtonProps as ChakraButtonProps,
    Spinner,
    HStack,
    Text,
    Box,
    useColorModeValue,
    Icon,
    Tooltip
} from '@chakra-ui/react';
import { keyframes } from '@emotion/react';
import { CheckCircle, AlertCircle, Loader } from 'lucide-react';

// Animation keyframes
const pulse = keyframes`
  0% { transform: scale(1); }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); }
`;

const shimmer = keyframes`
  0% { background-position: -200px 0; }
  100% { background-position: calc(200px + 100%) 0; }
`;

export type ButtonStatus = 'idle' | 'loading' | 'confirming' | 'success' | 'error' | 'disabled';

export interface EnhancedButtonProps extends Omit<ChakraButtonProps, 'isLoading' | 'loadingText'> {
    status?: ButtonStatus;
    loadingText?: string;
    successText?: string;
    errorText?: string;
    showStatusIcon?: boolean;
    enableShimmer?: boolean;
    enablePulse?: boolean;
    tooltip?: string;
    errorTooltip?: string;
}

export const EnhancedButton: React.FC<EnhancedButtonProps> = ({
    status = 'idle',
    loadingText = 'Loading...',
    successText,
    errorText,
    showStatusIcon = true,
    enableShimmer = false,
    enablePulse = false,
    tooltip,
    errorTooltip,
    children,
    isDisabled,
    onClick,
    ...props
}) => {
    const isDisabledState = isDisabled || status === 'disabled';
    const isLoading = status === 'loading';
    const isConfirming = status === 'confirming';
    const isSuccess = status === 'success';
    const isError = status === 'error';

    // Color scheme based on status
    const getColorScheme = () => {
        if (isError) return 'red';
        if (isSuccess) return 'green';
        if (isLoading || isConfirming) return 'blue';
        return props.colorScheme || 'blue';
    };

    // Background gradient based on status
    const getBgGradient = () => {
        if (isError) return 'linear(135deg, red.500, red.600, red.700)';
        if (isSuccess) return 'linear(135deg, green.500, green.600, green.700)';
        if (isLoading || isConfirming) return 'linear(135deg, blue.500, blue.600, blue.700)';
        return props.bgGradient;
    };

    // Get display text
    const getDisplayText = () => {
        if (isLoading) return loadingText;
        if (isConfirming) return 'Waiting for confirmation...';
        if (isSuccess && successText) return successText;
        if (isError && errorText) return errorText;
        return children;
    };

    // Get status icon
    const getStatusIcon = () => {
        if (!showStatusIcon) return null;

        if (isLoading || isConfirming) return <Loader size={16} />;
        if (isSuccess) return <CheckCircle size={16} />;
        if (isError) return <AlertCircle size={16} />;
        return null;
    };

    // Shimmer effect styles
    const shimmerStyles = enableShimmer ? {
        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
        backgroundSize: '200px 100%',
        animation: `${shimmer} 1.5s infinite`,
    } : {};

    // Pulse effect styles
    const pulseStyles = enablePulse && isLoading ? {
        animation: `${pulse} 2s infinite`,
    } : {};

    const buttonContent = (
        <ChakraButton
            {...props}
            colorScheme={getColorScheme()}
            bgGradient={getBgGradient()}
            isDisabled={isDisabledState}
            onClick={isLoading || isConfirming ? undefined : onClick}
            position="relative"
            overflow="hidden"
            _disabled={{
                bg: 'gray.600',
                color: 'gray.400',
                cursor: 'not-allowed',
                transform: 'none',
                boxShadow: 'none',
                opacity: 0.6,
            }}
            _hover={!isDisabledState ? {
                transform: 'translateY(-2px)',
                boxShadow: '0 8px 25px rgba(0, 0, 0, 0.3)',
                ...props._hover,
            } : {}}
            _active={!isDisabledState ? {
                transform: 'translateY(0px)',
                boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)',
                ...props._active,
            } : {}}
            transition="all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
            {...pulseStyles}
        >
            {/* Shimmer effect overlay */}
            {enableShimmer && (isLoading || isConfirming) && (
                <Box
                    position="absolute"
                    top="0"
                    left="0"
                    right="0"
                    bottom="0"
                    {...shimmerStyles}
                    pointerEvents="none"
                />
            )}

            <HStack spacing={2} align="center">
                {getStatusIcon()}
                <Text>{getDisplayText()}</Text>
            </HStack>
        </ChakraButton>
    );

    // Wrap with tooltip if provided
    if (tooltip || (isError && errorTooltip)) {
        return (
            <Tooltip
                label={isError && errorTooltip ? errorTooltip : tooltip}
                placement="top"
                hasArrow
                bg={isError ? 'red.500' : 'gray.700'}
                color="white"
            >
                {buttonContent}
            </Tooltip>
        );
    }

    return buttonContent;
};

// Preset button variants for common use cases
export const ActionButton: React.FC<EnhancedButtonProps> = (props) => (
    <EnhancedButton
        size="lg"
        borderRadius="xl"
        fontWeight="bold"
        fontSize="lg"
        py={6}
        px={8}
        boxShadow="0 8px 25px rgba(0, 0, 0, 0.3)"
        enableShimmer={props.status === 'loading'}
        {...props}
    />
);

export const PrimaryButton: React.FC<EnhancedButtonProps> = (props) => (
    <ActionButton
        bgGradient="linear(135deg, blue.500, purple.600, pink.500)"
        color="white"
        _hover={{
            bgGradient: "linear(135deg, blue.600, purple.700, pink.600)",
            transform: "translateY(-3px)",
            boxShadow: "0 15px 40px rgba(59, 130, 246, 0.6)",
        }}
        {...props}
    />
);

export const SuccessButton: React.FC<EnhancedButtonProps> = (props) => (
    <ActionButton
        bgGradient="linear(135deg, green.500, emerald.600, green.700)"
        color="white"
        _hover={{
            bgGradient: "linear(135deg, green.600, emerald.700, green.800)",
            transform: "translateY(-3px)",
            boxShadow: "0 15px 40px rgba(34, 197, 94, 0.6)",
        }}
        {...props}
    />
);

export const DangerButton: React.FC<EnhancedButtonProps> = (props) => (
    <ActionButton
        bgGradient="linear(135deg, red.500, red.600, red.700)"
        color="white"
        _hover={{
            bgGradient: "linear(135deg, red.600, red.700, red.800)",
            transform: "translateY(-3px)",
            boxShadow: "0 15px 40px rgba(239, 68, 68, 0.6)",
        }}
        {...props}
    />
);

export default EnhancedButton;
