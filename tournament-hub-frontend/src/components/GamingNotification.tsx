import React, { useState, useEffect } from 'react';
import {
    Box,
    Text,
    Icon,
    VStack,
    HStack,
    Button,
    useColorModeValue,
    Flex,
    Badge,
    Circle,
    useDisclosure,
    Collapse,
    ScaleFade,
    SlideFade
} from '@chakra-ui/react';
import { keyframes } from '@emotion/react';
import {
    CheckCircle,
    XCircle,
    AlertTriangle,
    Info,
    X,
    Zap,
    Trophy,
    Target,
    Shield,
    Star
} from 'lucide-react';

export interface GamingNotificationProps {
    id: string;
    type: 'success' | 'error' | 'warning' | 'info' | 'achievement' | 'level_up' | 'victory' | 'defeat';
    title: string;
    description?: string;
    duration?: number;
    onClose?: () => void;
    showProgress?: boolean;
    icon?: React.ReactNode;
    vibration?: boolean;
}

const pulse = keyframes`
    0% { transform: scale(1); }
    50% { transform: scale(1.05); }
    100% { transform: scale(1); }
`;

const glow = keyframes`
    0%, 100% { box-shadow: 0 0 20px rgba(59, 130, 246, 0.3); }
    50% { box-shadow: 0 0 30px rgba(59, 130, 246, 0.6); }
`;

const slideIn = keyframes`
    0% { transform: translateX(100%); opacity: 0; }
    100% { transform: translateX(0); opacity: 1; }
`;

const bounce = keyframes`
    0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
    40% { transform: translateY(-10px); }
    60% { transform: translateY(-5px); }
`;

export const GamingNotification: React.FC<GamingNotificationProps> = ({
    id,
    type,
    title,
    description,
    duration = 5000,
    onClose,
    showProgress = true,
    icon,
    vibration = false
}) => {
    const [progress, setProgress] = useState(100);
    const [isVisible, setIsVisible] = useState(true);
    const { isOpen, onClose: onCollapseClose } = useDisclosure({ defaultIsOpen: true });

    const bgColor = useColorModeValue('gray.800', 'gray.900');
    const borderColor = useColorModeValue('gray.600', 'gray.500');

    const getTypeConfig = () => {
        switch (type) {
            case 'success':
                return {
                    color: 'green',
                    bgGradient: 'linear(135deg, green.500, green.600, green.700)',
                    icon: <CheckCircle size={24} />,
                    borderColor: 'green.400',
                    glowColor: 'green.400'
                };
            case 'error':
                return {
                    color: 'red',
                    bgGradient: 'linear(135deg, red.500, red.600, red.700)',
                    icon: <XCircle size={24} />,
                    borderColor: 'red.400',
                    glowColor: 'red.400'
                };
            case 'warning':
                return {
                    color: 'yellow',
                    bgGradient: 'linear(135deg, yellow.500, yellow.600, yellow.700)',
                    icon: <AlertTriangle size={24} />,
                    borderColor: 'yellow.400',
                    glowColor: 'yellow.400'
                };
            case 'info':
                return {
                    color: 'blue',
                    bgGradient: 'linear(135deg, blue.500, blue.600, blue.700)',
                    icon: <Info size={24} />,
                    borderColor: 'blue.400',
                    glowColor: 'blue.400'
                };
            case 'achievement':
                return {
                    color: 'purple',
                    bgGradient: 'linear(135deg, purple.500, purple.600, purple.700)',
                    icon: <Trophy size={24} />,
                    borderColor: 'purple.400',
                    glowColor: 'purple.400'
                };
            case 'level_up':
                return {
                    color: 'cyan',
                    bgGradient: 'linear(135deg, cyan.500, cyan.600, cyan.700)',
                    icon: <Zap size={24} />,
                    borderColor: 'cyan.400',
                    glowColor: 'cyan.400'
                };
            case 'victory':
                return {
                    color: 'gold',
                    bgGradient: 'linear(135deg, yellow.400, yellow.500, yellow.600)',
                    icon: <Star size={24} />,
                    borderColor: 'yellow.300',
                    glowColor: 'yellow.300'
                };
            case 'defeat':
                return {
                    color: 'gray',
                    bgGradient: 'linear(135deg, gray.500, gray.600, gray.700)',
                    icon: <Shield size={24} />,
                    borderColor: 'gray.400',
                    glowColor: 'gray.400'
                };
            default:
                return {
                    color: 'blue',
                    bgGradient: 'linear(135deg, blue.500, blue.600, blue.700)',
                    icon: <Info size={24} />,
                    borderColor: 'blue.400',
                    glowColor: 'blue.400'
                };
        }
    };

    const config = getTypeConfig();

    useEffect(() => {
        if (vibration && 'vibrate' in navigator) {
            navigator.vibrate([200, 100, 200]);
        }
    }, [vibration]);

    useEffect(() => {
        if (duration > 0) {
            const interval = setInterval(() => {
                setProgress(prev => {
                    const newProgress = prev - (100 / (duration / 100));
                    if (newProgress <= 0) {
                        handleClose();
                        return 0;
                    }
                    return newProgress;
                });
            }, 100);

            return () => clearInterval(interval);
        }
    }, [duration]);

    const handleClose = () => {
        setIsVisible(false);
        setTimeout(() => {
            onClose?.();
        }, 300);
    };

    if (!isVisible) return null;

    return (
        <ScaleFade in={isVisible} initialScale={0.8}>
            <Box
                position="relative"
                bg={bgColor}
                border="2px solid"
                borderColor={config.borderColor}
                borderRadius="xl"
                p={4}
                minW="320px"
                maxW="400px"
                boxShadow="0 20px 40px rgba(0,0,0,0.3)"
                animation={`${slideIn} 0.3s ease-out`}
                _hover={{
                    transform: 'translateY(-2px)',
                    boxShadow: `0 25px 50px rgba(0,0,0,0.4), 0 0 30px ${config.glowColor}30`
                }}
                transition="all 0.3s ease"
                overflow="hidden"
            >
                {/* Animated border glow */}
                <Box
                    position="absolute"
                    top="-2px"
                    left="-2px"
                    right="-2px"
                    bottom="-2px"
                    borderRadius="xl"
                    bgGradient={config.bgGradient}
                    opacity="0.3"
                    animation={`${glow} 2s ease-in-out infinite`}
                    zIndex={-1}
                />

                {/* Progress bar */}
                {showProgress && duration > 0 && (
                    <Box
                        position="absolute"
                        top="0"
                        left="0"
                        right="0"
                        h="3px"
                        bg={config.borderColor}
                        borderRadius="xl"
                        overflow="hidden"
                    >
                        <Box
                            h="100%"
                            bgGradient={config.bgGradient}
                            width={`${progress}%`}
                            transition="width 0.1s linear"
                            animation={`${pulse} 1s ease-in-out infinite`}
                        />
                    </Box>
                )}

                <HStack spacing={3} align="start">
                    {/* Icon */}
                    <Circle
                        size="48px"
                        bgGradient={config.bgGradient}
                        color="white"
                        animation={type === 'achievement' || type === 'victory' ? `${bounce} 1s ease-in-out` : 'none'}
                        boxShadow="0 4px 12px rgba(0,0,0,0.3)"
                    >
                        {icon || config.icon}
                    </Circle>

                    {/* Content */}
                    <VStack spacing={2} align="start" flex={1}>
                        <HStack justify="space-between" w="full">
                            <Text
                                fontSize="lg"
                                fontWeight="bold"
                                color="white"
                                textShadow="0 2px 4px rgba(0,0,0,0.5)"
                            >
                                {title}
                            </Text>
                            <Button
                                size="sm"
                                variant="ghost"
                                color="white"
                                _hover={{ bg: 'whiteAlpha.200' }}
                                onClick={handleClose}
                                p={1}
                                minW="auto"
                                h="auto"
                            >
                                <X size={16} />
                            </Button>
                        </HStack>

                        {description && (
                            <Text
                                fontSize="sm"
                                color="gray.300"
                                lineHeight="1.4"
                            >
                                {description}
                            </Text>
                        )}

                        {/* Type badge */}
                        <Badge
                            colorScheme={config.color}
                            variant="solid"
                            borderRadius="full"
                            px={3}
                            py={1}
                            fontSize="xs"
                            fontWeight="bold"
                            textTransform="uppercase"
                            letterSpacing="0.5px"
                        >
                            {type.replace('_', ' ')}
                        </Badge>
                    </VStack>
                </HStack>

                {/* Decorative elements */}
                <Box
                    position="absolute"
                    top="-10px"
                    right="-10px"
                    w="20px"
                    h="20px"
                    borderRadius="full"
                    bg={config.borderColor}
                    opacity="0.2"
                    animation={`${pulse} 2s ease-in-out infinite`}
                />
                <Box
                    position="absolute"
                    bottom="-5px"
                    left="-5px"
                    w="15px"
                    h="15px"
                    borderRadius="full"
                    bg={config.borderColor}
                    opacity="0.3"
                    animation={`${pulse} 2s ease-in-out infinite 0.5s`}
                />
            </Box>
        </ScaleFade>
    );
};

// Notification Manager Component
export const GamingNotificationManager: React.FC = () => {
    const [notifications, setNotifications] = useState<GamingNotificationProps[]>([]);

    const addNotification = (notification: Omit<GamingNotificationProps, 'id'>) => {
        const id = Math.random().toString(36).substr(2, 9);
        setNotifications(prev => [...prev, { ...notification, id }]);
    };

    const removeNotification = (id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    };

    // Expose addNotification globally
    useEffect(() => {
        (window as any).addGamingNotification = addNotification;
        return () => {
            delete (window as any).addGamingNotification;
        };
    }, []);

    return (
        <Box
            position="fixed"
            top="20px"
            right="20px"
            zIndex={9999}
            maxH="80vh"
            overflowY="auto"
        >
            <VStack spacing={3} align="stretch">
                {notifications.map(notification => (
                    <GamingNotification
                        key={notification.id}
                        {...notification}
                        onClose={() => removeNotification(notification.id)}
                    />
                ))}
            </VStack>
        </Box>
    );
};
