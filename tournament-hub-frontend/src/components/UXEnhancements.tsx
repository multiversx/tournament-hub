import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import {
    Box,
    Text,
    VStack,
    HStack,
    Icon,
    useToast,
    useDisclosure,
    Modal,
    ModalOverlay,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalCloseButton,
    Button,
    Progress,
    CircularProgress,
    CircularProgressLabel,
    Alert,
    AlertIcon,
    AlertTitle,
    AlertDescription,
    Badge,
    useColorModeValue,
} from '@chakra-ui/react';
import { CheckCircle, AlertCircle, XCircle, Info, Loader2, Zap, Trophy, Gamepad2 } from 'lucide-react';
import { keyframes as emotionKeyframes } from '@emotion/react';

// Animation keyframes
const slideIn = emotionKeyframes`
  from { transform: translateY(-100%); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
`;

const slideOut = emotionKeyframes`
  from { transform: translateY(0); opacity: 1; }
  to { transform: translateY(-100%); opacity: 0; }
`;

const pulse = emotionKeyframes`
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
`;

const shimmer = emotionKeyframes`
  0% { background-position: -200px 0; }
  100% { background-position: calc(200px + 100%) 0; }
`;

// Types
export type NotificationType = 'success' | 'error' | 'warning' | 'info' | 'loading';
export type NotificationPosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center';

export interface Notification {
    id: string;
    type: NotificationType;
    title: string;
    description?: string;
    duration?: number;
    position?: NotificationPosition;
    persistent?: boolean;
    actions?: NotificationAction[];
    progress?: number;
    icon?: React.ReactNode;
}

export interface NotificationAction {
    label: string;
    onClick: () => void;
    variant?: 'solid' | 'outline' | 'ghost';
    colorScheme?: string;
}

export interface UXContextType {
    showNotification: (notification: Omit<Notification, 'id'>) => string;
    hideNotification: (id: string) => void;
    showLoading: (title: string, description?: string) => string;
    hideLoading: (id: string) => void;
    showError: (title: string, description?: string, actions?: NotificationAction[]) => string;
    showSuccess: (title: string, description?: string) => string;
    showWarning: (title: string, description?: string) => string;
    showInfo: (title: string, description?: string) => string;
    clearAll: () => void;
}

const UXContext = createContext<UXContextType | undefined>(undefined);

export const useUX = () => {
    const context = useContext(UXContext);
    if (!context) {
        throw new Error('useUX must be used within a UXProvider');
    }
    return context;
};

// Notification Component
const NotificationItem: React.FC<{
    notification: Notification;
    onClose: (id: string) => void;
    onAction: (action: NotificationAction) => void;
}> = ({ notification, onClose, onAction }) => {
    const [isVisible, setIsVisible] = useState(true);
    const [progress, setProgress] = useState(0);
    const bgColor = useColorModeValue('white', 'gray.800');
    const borderColor = useColorModeValue('gray.200', 'gray.600');

    const getIcon = () => {
        if (notification.icon) return notification.icon;

        switch (notification.type) {
            case 'success': return <CheckCircle size={20} />;
            case 'error': return <XCircle size={20} />;
            case 'warning': return <AlertCircle size={20} />;
            case 'info': return <Info size={20} />;
            case 'loading': return <Loader2 size={20} className="animate-spin" />;
            default: return <Info size={20} />;
        }
    };

    const getColorScheme = () => {
        switch (notification.type) {
            case 'success': return 'green';
            case 'error': return 'red';
            case 'warning': return 'orange';
            case 'info': return 'blue';
            case 'loading': return 'blue';
            default: return 'gray';
        }
    };

    useEffect(() => {
        if (notification.duration && notification.duration > 0) {
            const interval = setInterval(() => {
                setProgress(prev => {
                    const newProgress = prev + (100 / (notification.duration! / 100));
                    if (newProgress >= 100) {
                        setIsVisible(false);
                        setTimeout(() => onClose(notification.id), 300);
                        return 100;
                    }
                    return newProgress;
                });
            }, 100);

            return () => clearInterval(interval);
        }
    }, [notification.duration, notification.id, onClose]);

    if (!isVisible) return null;

    return (
        <Box
            bg={bgColor}
            border="1px solid"
            borderColor={borderColor}
            borderRadius="lg"
            p={4}
            mb={3}
            boxShadow="0 4px 12px rgba(0, 0, 0, 0.15)"
            minW="320px"
            maxW="400px"
            animation={`${slideIn} 0.3s ease-out`}
            position="relative"
            overflow="hidden"
        >
            {/* Progress bar */}
            {notification.duration && notification.duration > 0 && (
                <Box position="absolute" top="0" left="0" right="0" h="2px" bg="gray.200">
                    <Box
                        h="100%"
                        bg={`${getColorScheme()}.500`}
                        w={`${progress}%`}
                        transition="width 0.1s linear"
                    />
                </Box>
            )}

            <HStack align="start" spacing={3}>
                <Icon
                    as={getIcon}
                    color={`${getColorScheme()}.500`}
                    flexShrink={0}
                    mt={0.5}
                />

                <VStack align="start" spacing={2} flex={1}>
                    <Text fontWeight="semibold" fontSize="sm">
                        {notification.title}
                    </Text>
                    {notification.description && (
                        <Text fontSize="sm" color="gray.600">
                            {notification.description}
                        </Text>
                    )}

                    {/* Progress indicator for loading */}
                    {notification.type === 'loading' && notification.progress !== undefined && (
                        <Box w="100%">
                            <Progress
                                value={notification.progress}
                                size="sm"
                                colorScheme={getColorScheme()}
                                borderRadius="full"
                            />
                        </Box>
                    )}

                    {/* Actions */}
                    {notification.actions && notification.actions.length > 0 && (
                        <HStack spacing={2} mt={2}>
                            {notification.actions.map((action, index) => (
                                <Button
                                    key={index}
                                    size="xs"
                                    variant={action.variant || 'outline'}
                                    colorScheme={action.colorScheme || getColorScheme()}
                                    onClick={() => onAction(action)}
                                >
                                    {action.label}
                                </Button>
                            ))}
                        </HStack>
                    )}
                </VStack>

                {!notification.persistent && (
                    <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => {
                            setIsVisible(false);
                            setTimeout(() => onClose(notification.id), 300);
                        }}
                        p={1}
                        minW="auto"
                        h="auto"
                    >
                        <XCircle size={16} />
                    </Button>
                )}
            </HStack>
        </Box>
    );
};

// Notification Container
const NotificationContainer: React.FC<{
    notifications: Notification[];
    onClose: (id: string) => void;
    onAction: (action: NotificationAction) => void;
    position: NotificationPosition;
}> = ({ notifications, onClose, onAction, position }) => {
    const getPositionStyles = () => {
        const baseStyles = {
            position: 'fixed' as const,
            zIndex: 1000,
            maxH: '100vh',
            overflowY: 'auto' as const,
        };

        switch (position) {
            case 'top-right':
                return { ...baseStyles, top: 4, right: 4 };
            case 'top-left':
                return { ...baseStyles, top: 4, left: 4 };
            case 'bottom-right':
                return { ...baseStyles, bottom: 4, right: 4 };
            case 'bottom-left':
                return { ...baseStyles, bottom: 4, left: 4 };
            case 'top-center':
                return { ...baseStyles, top: 4, left: '50%', transform: 'translateX(-50%)' };
            default:
                return { ...baseStyles, top: 4, right: 4 };
        }
    };

    if (notifications.length === 0) return null;

    return (
        <Box {...getPositionStyles()}>
            {notifications.map(notification => (
                <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onClose={onClose}
                    onAction={onAction}
                />
            ))}
        </Box>
    );
};

// UX Provider
export const UXProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const toast = useToast();

    const generateId = () => Math.random().toString(36).substr(2, 9);

    const showNotification = useCallback((notification: Omit<Notification, 'id'>) => {
        const id = generateId();
        const newNotification: Notification = {
            id,
            duration: 5000,
            position: 'top-right',
            ...notification,
        };

        setNotifications(prev => [...prev, newNotification]);

        // Auto-remove after duration
        if (newNotification.duration && newNotification.duration > 0) {
            setTimeout(() => {
                hideNotification(id);
            }, newNotification.duration);
        }

        return id;
    }, []);

    const hideNotification = useCallback((id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    }, []);

    const showLoading = useCallback((title: string, description?: string) => {
        return showNotification({
            type: 'loading',
            title,
            description,
            persistent: true,
            duration: 0,
        });
    }, [showNotification]);

    const hideLoading = useCallback((id: string) => {
        hideNotification(id);
    }, [hideNotification]);

    const showError = useCallback((title: string, description?: string, actions?: NotificationAction[]) => {
        return showNotification({
            type: 'error',
            title,
            description,
            actions,
            duration: 8000,
        });
    }, [showNotification]);

    const showSuccess = useCallback((title: string, description?: string) => {
        return showNotification({
            type: 'success',
            title,
            description,
            duration: 4000,
        });
    }, [showNotification]);

    const showWarning = useCallback((title: string, description?: string) => {
        return showNotification({
            type: 'warning',
            title,
            description,
            duration: 6000,
        });
    }, [showNotification]);

    const showInfo = useCallback((title: string, description?: string) => {
        return showNotification({
            type: 'info',
            title,
            description,
            duration: 5000,
        });
    }, [showNotification]);

    const clearAll = useCallback(() => {
        setNotifications([]);
    }, []);

    const handleAction = useCallback((action: NotificationAction) => {
        action.onClick();
    }, []);

    const contextValue: UXContextType = {
        showNotification,
        hideNotification,
        showLoading,
        hideLoading,
        showError,
        showSuccess,
        showWarning,
        showInfo,
        clearAll,
    };

    // Group notifications by position
    const notificationsByPosition = notifications.reduce((acc, notification) => {
        const position = notification.position || 'top-right';
        if (!acc[position]) acc[position] = [];
        acc[position].push(notification);
        return acc;
    }, {} as Record<NotificationPosition, Notification[]>);

    return (
        <UXContext.Provider value={contextValue}>
            {children}

            {/* Render notification containers for each position */}
            {Object.entries(notificationsByPosition).map(([position, positionNotifications]) => (
                <NotificationContainer
                    key={position}
                    notifications={positionNotifications}
                    onClose={hideNotification}
                    onAction={handleAction}
                    position={position as NotificationPosition}
                />
            ))}
        </UXContext.Provider>
    );
};

// Enhanced Loading Overlay
export const EnhancedLoadingOverlay: React.FC<{
    isVisible: boolean;
    title: string;
    description?: string;
    progress?: number;
    variant?: 'default' | 'gaming' | 'tournament' | 'transaction';
    onCancel?: () => void;
}> = ({ isVisible, title, description, progress, variant = 'default', onCancel }) => {
    const bgColor = useColorModeValue('rgba(255, 255, 255, 0.9)', 'rgba(0, 0, 0, 0.8)');

    if (!isVisible) return null;

    const getIcon = () => {
        switch (variant) {
            case 'gaming': return <Gamepad2 size={48} />;
            case 'tournament': return <Trophy size={48} />;
            case 'transaction': return <Zap size={48} />;
            default: return <Loader2 size={48} className="animate-spin" />;
        }
    };

    return (
        <Box
            position="fixed"
            top="0"
            left="0"
            right="0"
            bottom="0"
            bg={bgColor}
            display="flex"
            alignItems="center"
            justifyContent="center"
            zIndex={9999}
            backdropFilter="blur(4px)"
        >
            <Box
                bg="white"
                p={8}
                borderRadius="2xl"
                boxShadow="0 20px 40px rgba(0, 0, 0, 0.3)"
                textAlign="center"
                minW="300px"
                maxW="400px"
            >
                <VStack spacing={6}>
                    <Box
                        color="blue.500"
                        animation={variant === 'default' ? `${pulse} 2s infinite` : undefined}
                    >
                        {getIcon()}
                    </Box>

                    <VStack spacing={2}>
                        <Text fontSize="xl" fontWeight="bold">
                            {title}
                        </Text>
                        {description && (
                            <Text color="gray.600" textAlign="center">
                                {description}
                            </Text>
                        )}
                    </VStack>

                    {progress !== undefined ? (
                        <Box w="100%">
                            <CircularProgress
                                value={progress}
                                size="80px"
                                thickness="8px"
                                color="blue.500"
                                trackColor="gray.200"
                            >
                                <CircularProgressLabel>
                                    <Text fontSize="sm" fontWeight="bold">
                                        {Math.round(progress)}%
                                    </Text>
                                </CircularProgressLabel>
                            </CircularProgress>
                        </Box>
                    ) : (
                        <Box w="100%">
                            <Progress
                                size="sm"
                                colorScheme="blue"
                                borderRadius="full"
                                isIndeterminate
                            />
                        </Box>
                    )}

                    {onCancel && (
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={onCancel}
                            colorScheme="gray"
                        >
                            Cancel
                        </Button>
                    )}
                </VStack>
            </Box>
        </Box>
    );
};

export default UXProvider;
