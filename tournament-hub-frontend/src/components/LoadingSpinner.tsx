import React from 'react';
import {
    Box,
    Spinner,
    Text,
    VStack,
    HStack,
    useColorModeValue,
    Progress,
    CircularProgress,
    CircularProgressLabel,
} from '@chakra-ui/react';
import { keyframes } from '@emotion/react';
import { Loader2, Zap, Trophy, Gamepad2 } from 'lucide-react';

// Animation keyframes
const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
`;

const bounce = keyframes`
  0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
  40% { transform: translateY(-10px); }
  60% { transform: translateY(-5px); }
`;

const shimmer = keyframes`
  0% { background-position: -200px 0; }
  100% { background-position: calc(200px + 100%) 0; }
`;

export interface LoadingSpinnerProps {
    size?: 'sm' | 'md' | 'lg' | 'xl';
    text?: string;
    showProgress?: boolean;
    progress?: number;
    variant?: 'default' | 'gaming' | 'tournament' | 'transaction';
    enableShimmer?: boolean;
    enableBounce?: boolean;
    color?: string;
}

const sizeMap = {
    sm: { spinner: 'sm', text: 'sm' },
    md: { spinner: 'md', text: 'md' },
    lg: { spinner: 'lg', text: 'lg' },
    xl: { spinner: 'xl', text: 'xl' },
};

const variantIcons = {
    default: Loader2,
    gaming: Gamepad2,
    tournament: Trophy,
    transaction: Zap,
};

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
    size = 'md',
    text,
    showProgress = false,
    progress = 0,
    variant = 'default',
    enableShimmer = false,
    enableBounce = false,
    color,
}) => {
    const spinnerSize = sizeMap[size].spinner;
    const textSize = sizeMap[size].text;
    const IconComponent = variantIcons[variant];

    const defaultColor = useColorModeValue('blue.500', 'blue.400');
    const spinnerColor = color || defaultColor;

    const spinAnimation = `${spin} 1s linear infinite`;
    const pulseAnimation = `${pulse} 2s ease-in-out infinite`;
    const bounceAnimation = `${bounce} 1s ease-in-out infinite`;
    const shimmerAnimation = `${shimmer} 1.5s ease-in-out infinite`;

    const animations = [
        spinAnimation,
        enableBounce ? bounceAnimation : undefined,
        enableShimmer ? pulseAnimation : undefined,
    ].filter(Boolean).join(', ');

    const shimmerStyles = enableShimmer ? {
        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
        backgroundSize: '200px 100%',
        animation: shimmerAnimation,
    } : {};

    if (showProgress && progress !== undefined) {
        return (
            <VStack spacing={4} align="center">
                <Box position="relative">
                    <CircularProgress
                        value={progress}
                        size="120px"
                        thickness="8px"
                        color={spinnerColor}
                        trackColor="gray.200"
                    >
                        <CircularProgressLabel>
                            <VStack spacing={1}>
                                <IconComponent size={24} />
                                <Text fontSize="xs" fontWeight="bold">
                                    {Math.round(progress)}%
                                </Text>
                            </VStack>
                        </CircularProgressLabel>
                    </CircularProgress>
                    {enableShimmer && (
                        <Box
                            position="absolute"
                            top="0"
                            left="0"
                            right="0"
                            bottom="0"
                            borderRadius="full"
                            {...shimmerStyles}
                            pointerEvents="none"
                        />
                    )}
                </Box>
                {text && (
                    <Text fontSize={textSize} color="gray.600" textAlign="center">
                        {text}
                    </Text>
                )}
            </VStack>
        );
    }

    return (
        <VStack spacing={4} align="center">
            <Box position="relative">
                <HStack spacing={2} align="center">
                    <Spinner
                        size={spinnerSize}
                        color={spinnerColor}
                        thickness="4px"
                        speed="0.8s"
                    />
                    <IconComponent
                        size={size === 'xl' ? 32 : size === 'lg' ? 24 : 20}
                        style={{
                            animation: animations,
                            color: spinnerColor,
                        }}
                    />
                </HStack>
                {enableShimmer && (
                    <Box
                        position="absolute"
                        top="0"
                        left="0"
                        right="0"
                        bottom="0"
                        borderRadius="full"
                        {...shimmerStyles}
                        pointerEvents="none"
                    />
                )}
            </Box>
            {text && (
                <Text fontSize={textSize} color="gray.600" textAlign="center" maxW="300px">
                    {text}
                </Text>
            )}
        </VStack>
    );
};

// Specialized loading components for different contexts
export const GameLoadingSpinner: React.FC<Omit<LoadingSpinnerProps, 'variant'>> = (props) => (
    <LoadingSpinner variant="gaming" enableBounce {...props} />
);

export const TournamentLoadingSpinner: React.FC<Omit<LoadingSpinnerProps, 'variant'>> = (props) => (
    <LoadingSpinner variant="tournament" enableShimmer {...props} />
);

export const TransactionLoadingSpinner: React.FC<Omit<LoadingSpinnerProps, 'variant'>> = (props) => (
    <LoadingSpinner variant="transaction" enableShimmer {...props} />
);

// Loading overlay component
export interface LoadingOverlayProps {
    isVisible: boolean;
    text?: string;
    variant?: LoadingSpinnerProps['variant'];
    backdrop?: boolean;
    zIndex?: number;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
    isVisible,
    text,
    variant = 'default',
    backdrop = true,
    zIndex = 1000,
}) => {
    if (!isVisible) return null;

    return (
        <Box
            position="fixed"
            top="0"
            left="0"
            right="0"
            bottom="0"
            bg={backdrop ? 'rgba(0, 0, 0, 0.7)' : 'transparent'}
            display="flex"
            alignItems="center"
            justifyContent="center"
            zIndex={zIndex}
        >
            <Box
                bg="white"
                p={8}
                borderRadius="xl"
                boxShadow="0 20px 40px rgba(0, 0, 0, 0.3)"
                textAlign="center"
            >
                <LoadingSpinner variant={variant} size="lg" text={text} />
            </Box>
        </Box>
    );
};

export default LoadingSpinner;
