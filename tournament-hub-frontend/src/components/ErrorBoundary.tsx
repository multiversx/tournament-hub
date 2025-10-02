import React, { Component, ErrorInfo, ReactNode } from 'react';
import {
    Box,
    Button,
    VStack,
    Text,
    Heading,
    Alert,
    AlertIcon,
    AlertTitle,
    AlertDescription,
    Code,
    HStack,
    Icon,
    Collapse,
    useDisclosure,
    Badge,
    Divider,
} from '@chakra-ui/react';
import { AlertTriangle, RefreshCw, Bug, Home, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
    showDetails?: boolean;
    enableRetry?: boolean;
    enableReport?: boolean;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
    errorId: string;
}

export class ErrorBoundary extends Component<Props, State> {
    private retryCount = 0;
    private maxRetries = 3;

    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
            errorId: '',
        };
    }

    static getDerivedStateFromError(error: Error): Partial<State> {
        return {
            hasError: true,
            error,
            errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        this.setState({
            error,
            errorInfo,
        });

        // Log error to console in development
        if (process.env.NODE_ENV === 'development') {
            console.error('ErrorBoundary caught an error:', error, errorInfo);
        }

        // Call custom error handler
        this.props.onError?.(error, errorInfo);

        // Report error to monitoring service (if available)
        this.reportError(error, errorInfo);
    }

    private reportError = (error: Error, errorInfo: ErrorInfo) => {
        // In a real application, you would send this to your error monitoring service
        // For now, we'll just log it
        console.error('Error reported:', {
            error: error.message,
            stack: error.stack,
            componentStack: errorInfo.componentStack,
            errorId: this.state.errorId,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            url: window.location.href,
        });
    };

    private handleRetry = () => {
        if (this.retryCount < this.maxRetries) {
            this.retryCount++;
            this.setState({
                hasError: false,
                error: null,
                errorInfo: null,
                errorId: '',
            });
        }
    };

    private handleReset = () => {
        this.retryCount = 0;
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null,
            errorId: '',
        });
    };

    private handleGoHome = () => {
        window.location.href = '/';
    };

    private handleReportBug = () => {
        const errorData = {
            error: this.state.error?.message,
            stack: this.state.error?.stack,
            componentStack: this.state.errorInfo?.componentStack,
            errorId: this.state.errorId,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            url: window.location.href,
        };

        // In a real application, you would open a bug report form or send to your support system
        const bugReportUrl = `mailto:support@example.com?subject=Bug Report - ${this.state.errorId}&body=${encodeURIComponent(JSON.stringify(errorData, null, 2))}`;
        window.open(bugReportUrl);
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return <ErrorFallback
                error={this.state.error}
                errorInfo={this.state.errorInfo}
                errorId={this.state.errorId}
                retryCount={this.retryCount}
                maxRetries={this.maxRetries}
                showDetails={this.props.showDetails}
                enableRetry={this.props.enableRetry}
                enableReport={this.props.enableReport}
                onRetry={this.handleRetry}
                onReset={this.handleReset}
                onGoHome={this.handleGoHome}
                onReportBug={this.handleReportBug}
            />;
        }

        return this.props.children;
    }
}

interface ErrorFallbackProps {
    error: Error | null;
    errorInfo: ErrorInfo | null;
    errorId: string;
    retryCount: number;
    maxRetries: number;
    showDetails?: boolean;
    enableRetry?: boolean;
    enableReport?: boolean;
    onRetry: () => void;
    onReset: () => void;
    onGoHome: () => void;
    onReportBug: () => void;
}

const ErrorFallback: React.FC<ErrorFallbackProps> = ({
    error,
    errorInfo,
    errorId,
    retryCount,
    maxRetries,
    showDetails = false,
    enableRetry = true,
    enableReport = true,
    onRetry,
    onReset,
    onGoHome,
    onReportBug,
}) => {
    const { isOpen, onToggle } = useDisclosure();

    return (
        <Box
            minH="100vh"
            display="flex"
            alignItems="center"
            justifyContent="center"
            bg="gray.50"
            p={4}
        >
            <Box
                maxW="600px"
                w="full"
                bg="white"
                borderRadius="xl"
                boxShadow="0 10px 30px rgba(0, 0, 0, 0.1)"
                p={8}
            >
                <VStack spacing={6} align="stretch">
                    {/* Header */}
                    <VStack spacing={4} textAlign="center">
                        <Icon as={AlertTriangle} boxSize={16} color="red.500" />
                        <Heading size="lg" color="red.600">
                            Oops! Something went wrong
                        </Heading>
                        <Text color="gray.600">
                            We encountered an unexpected error. Don't worry, we're working to fix it.
                        </Text>
                        <Badge colorScheme="red" variant="subtle">
                            Error ID: {errorId}
                        </Badge>
                    </VStack>

                    {/* Error Message */}
                    {error && (
                        <Alert status="error" borderRadius="md">
                            <AlertIcon />
                            <Box>
                                <AlertTitle>Error Details:</AlertTitle>
                                <AlertDescription>
                                    {error.message || 'An unknown error occurred'}
                                </AlertDescription>
                            </Box>
                        </Alert>
                    )}

                    {/* Action Buttons */}
                    <HStack spacing={4} justify="center" wrap="wrap">
                        {enableRetry && retryCount < maxRetries && (
                            <Button
                                leftIcon={<RefreshCw size={16} />}
                                colorScheme="blue"
                                onClick={onRetry}
                            >
                                Try Again ({maxRetries - retryCount} attempts left)
                            </Button>
                        )}

                        <Button
                            leftIcon={<Home size={16} />}
                            colorScheme="gray"
                            variant="outline"
                            onClick={onGoHome}
                        >
                            Go Home
                        </Button>

                        <Button
                            onClick={onReset}
                            colorScheme="green"
                            variant="outline"
                        >
                            Reset Application
                        </Button>
                    </HStack>

                    {/* Technical Details */}
                    {showDetails && error && (
                        <Box>
                            <Button
                                size="sm"
                                variant="ghost"
                                rightIcon={isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                onClick={onToggle}
                                mb={4}
                            >
                                {isOpen ? 'Hide' : 'Show'} Technical Details
                            </Button>

                            <Collapse in={isOpen}>
                                <VStack spacing={4} align="stretch">
                                    <Divider />

                                    <Box>
                                        <Text fontWeight="semibold" mb={2}>
                                            Error Stack:
                                        </Text>
                                        <Code
                                            p={4}
                                            borderRadius="md"
                                            fontSize="sm"
                                            whiteSpace="pre-wrap"
                                            overflowX="auto"
                                            display="block"
                                        >
                                            {error.stack}
                                        </Code>
                                    </Box>

                                    {errorInfo && (
                                        <Box>
                                            <Text fontWeight="semibold" mb={2}>
                                                Component Stack:
                                            </Text>
                                            <Code
                                                p={4}
                                                borderRadius="md"
                                                fontSize="sm"
                                                whiteSpace="pre-wrap"
                                                overflowX="auto"
                                                display="block"
                                            >
                                                {errorInfo.componentStack}
                                            </Code>
                                        </Box>
                                    )}

                                    <Box>
                                        <Text fontWeight="semibold" mb={2}>
                                            Environment:
                                        </Text>
                                        <Code p={2} borderRadius="md" fontSize="sm">
                                            {navigator.userAgent}
                                        </Code>
                                    </Box>

                                    {enableReport && (
                                        <Button
                                            leftIcon={<Bug size={16} />}
                                            colorScheme="orange"
                                            variant="outline"
                                            onClick={onReportBug}
                                            size="sm"
                                        >
                                            Report This Bug
                                        </Button>
                                    )}
                                </VStack>
                            </Collapse>
                        </Box>
                    )}
                </VStack>
            </Box>
        </Box>
    );
};

// Hook for error boundary context
export const useErrorBoundary = () => {
    const [error, setError] = React.useState<Error | null>(null);

    const resetError = React.useCallback(() => {
        setError(null);
    }, []);

    const captureError = React.useCallback((error: Error) => {
        setError(error);
    }, []);

    React.useEffect(() => {
        if (error) {
            throw error;
        }
    }, [error]);

    return { captureError, resetError };
};

export default ErrorBoundary;
