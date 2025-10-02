import React from 'react';
import {
    Box,
    Button,
    VStack,
    HStack,
    Text,
    Icon,
    Alert,
    AlertIcon,
    AlertTitle,
    AlertDescription,
    useColorModeValue,
} from '@chakra-ui/react';
import { RefreshCw, AlertTriangle, Wifi, WifiOff } from 'lucide-react';

export interface ErrorRetryProps {
    error?: string | null;
    onRetry?: () => void;
    isRetrying?: boolean;
    variant?: 'minimal' | 'full' | 'inline';
    title?: string;
    description?: string;
    showRetryButton?: boolean;
    retryButtonText?: string;
    size?: 'sm' | 'md' | 'lg';
}

export const ErrorRetry: React.FC<ErrorRetryProps> = ({
    error,
    onRetry,
    isRetrying = false,
    variant = 'full',
    title = 'Something went wrong',
    description,
    showRetryButton = true,
    retryButtonText = 'Try Again',
    size = 'md',
}) => {
    const bgColor = useColorModeValue('red.50', 'red.900');
    const borderColor = useColorModeValue('red.200', 'red.700');
    const textColor = useColorModeValue('red.800', 'red.200');

    const getErrorIcon = () => {
        if (error?.toLowerCase().includes('network') || error?.toLowerCase().includes('fetch')) {
            return WifiOff;
        }
        return AlertTriangle;
    };

    const getErrorDescription = () => {
        if (description) return description;

        if (error?.toLowerCase().includes('network') || error?.toLowerCase().includes('fetch')) {
            return 'Please check your internet connection and try again.';
        }

        if (error?.toLowerCase().includes('timeout')) {
            return 'The request took too long. Please try again.';
        }

        return error || 'An unexpected error occurred. Please try again.';
    };

    if (variant === 'minimal') {
        return (
            <HStack spacing={2} align="center" justify="center">
                <Icon as={getErrorIcon()} color="red.400" boxSize={4} />
                <Text color="red.400" fontSize="sm">
                    {getErrorDescription()}
                </Text>
                {showRetryButton && onRetry && (
                    <Button
                        size="xs"
                        variant="ghost"
                        colorScheme="red"
                        onClick={onRetry}
                        isLoading={isRetrying}
                        loadingText="Retrying..."
                        leftIcon={<RefreshCw size={12} />}
                    >
                        Retry
                    </Button>
                )}
            </HStack>
        );
    }

    if (variant === 'inline') {
        return (
            <Box
                bg={bgColor}
                border="1px solid"
                borderColor={borderColor}
                borderRadius="md"
                p={3}
            >
                <HStack spacing={3} align="start">
                    <Icon as={getErrorIcon()} color="red.500" boxSize={5} mt={0.5} />
                    <VStack spacing={2} align="start" flex={1}>
                        <Text color={textColor} fontSize="sm" fontWeight="medium">
                            {title}
                        </Text>
                        <Text color={textColor} fontSize="xs">
                            {getErrorDescription()}
                        </Text>
                        {showRetryButton && onRetry && (
                            <Button
                                size="xs"
                                variant="outline"
                                colorScheme="red"
                                onClick={onRetry}
                                isLoading={isRetrying}
                                loadingText="Retrying..."
                                leftIcon={<RefreshCw size={12} />}
                            >
                                {retryButtonText}
                            </Button>
                        )}
                    </VStack>
                </HStack>
            </Box>
        );
    }

    // Full variant (default)
    return (
        <Alert status="error" variant="subtle" borderRadius="md">
            <AlertIcon />
            <Box flex="1">
                <AlertTitle fontSize="md">{title}</AlertTitle>
                <AlertDescription fontSize="sm">
                    {getErrorDescription()}
                </AlertDescription>
                {showRetryButton && onRetry && (
                    <Button
                        size="sm"
                        variant="outline"
                        colorScheme="red"
                        onClick={onRetry}
                        isLoading={isRetrying}
                        loadingText="Retrying..."
                        leftIcon={<RefreshCw size={16} />}
                        mt={3}
                    >
                        {retryButtonText}
                    </Button>
                )}
            </Box>
        </Alert>
    );
};

// Specialized error components for different contexts
export const NetworkError: React.FC<Omit<ErrorRetryProps, 'title' | 'description'>> = (props) => (
    <ErrorRetry
        {...props}
        title="Connection Error"
        description="Please check your internet connection and try again."
    />
);

export const DataLoadError: React.FC<Omit<ErrorRetryProps, 'title' | 'description'>> = (props) => (
    <ErrorRetry
        {...props}
        title="Failed to Load Data"
        description="We couldn't fetch the latest information. Please try refreshing."
    />
);

export const TournamentError: React.FC<Omit<ErrorRetryProps, 'title' | 'description'>> = (props) => (
    <ErrorRetry
        {...props}
        title="Tournament Error"
        description="There was an issue loading tournament data. Please try again."
    />
);

export default ErrorRetry;
