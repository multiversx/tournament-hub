import React, { useState, useEffect } from 'react';
import {
    Box,
    Text,
    VStack,
    HStack,
    useColorModeValue,
    Fade,
    ScaleFade,
    SlideFade,
} from '@chakra-ui/react';
import { keyframes } from '@emotion/react';

const countUp = keyframes`
  from { transform: scale(0.8); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
`;

const slideIn = keyframes`
  from { transform: translateX(-20px); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
`;

export interface ProgressiveLoaderProps {
    children: React.ReactNode;
    isLoading: boolean;
    delay?: number;
    animation?: 'fade' | 'scale' | 'slide' | 'count-up';
    showWhileLoading?: boolean;
    loadingComponent?: React.ReactNode;
}

export const ProgressiveLoader: React.FC<ProgressiveLoaderProps> = ({
    children,
    isLoading,
    delay = 0,
    animation = 'fade',
    showWhileLoading = true,
    loadingComponent,
}) => {
    const [isVisible, setIsVisible] = useState(!isLoading);
    const [showContent, setShowContent] = useState(!isLoading);

    useEffect(() => {
        if (!isLoading) {
            const timer = setTimeout(() => {
                setIsVisible(true);
                setShowContent(true);
            }, delay);

            return () => clearTimeout(timer);
        } else {
            setIsVisible(false);
            const timer = setTimeout(() => {
                setShowContent(false);
            }, 300); // Wait for animation to complete

            return () => clearTimeout(timer);
        }
    }, [isLoading, delay]);

    const getAnimationProps = () => {
        switch (animation) {
            case 'fade':
                return {
                    in: isVisible,
                };
            case 'scale':
                return {
                    in: isVisible,
                    initialScale: 0.95,
                };
            case 'slide':
                return {
                    in: isVisible,
                    offsetY: 20,
                };
            case 'count-up':
                return {
                    style: {
                        animation: isVisible ? `${countUp} 0.6s ease-out forwards` : 'none',
                        opacity: isVisible ? 1 : 0,
                    },
                };
            default:
                return {};
        }
    };

    if (isLoading && showWhileLoading) {
        return (
            <Box>
                {loadingComponent || (
                    <Box
                        opacity={0.6}
                        filter="blur(1px)"
                        transition="all 0.3s ease"
                    >
                        {children}
                    </Box>
                )}
            </Box>
        );
    }

    if (!showContent) {
        return null;
    }

    const animationProps = getAnimationProps();

    if (animation === 'count-up') {
        return (
            <Box {...animationProps}>
                {children}
            </Box>
        );
    }

    if (animation === 'fade') {
        return (
            <Fade {...animationProps}>
                {children}
            </Fade>
        );
    }

    if (animation === 'scale') {
        return (
            <ScaleFade {...animationProps}>
                {children}
            </ScaleFade>
        );
    }

    if (animation === 'slide') {
        return (
            <SlideFade {...animationProps}>
                {children}
            </SlideFade>
        );
    }

    return <Box>{children}</Box>;
};

// Specialized progressive loader for statistics
export interface StatLoaderProps {
    value: number;
    isLoading: boolean;
    delay?: number;
    suffix?: string;
    prefix?: string;
    color?: string;
    fontSize?: string;
    fontWeight?: string;
    formatValue?: (value: number) => string;
    isInteger?: boolean; // New prop to indicate if value should be displayed as integer
}

export const StatLoader: React.FC<StatLoaderProps> = ({
    value,
    isLoading,
    delay = 0,
    suffix = '',
    prefix = '',
    color = 'blue.400',
    fontSize = '2xl',
    fontWeight = 'bold',
    formatValue,
    isInteger = false,
}) => {
    const [displayValue, setDisplayValue] = useState(0.0);
    const [isAnimating, setIsAnimating] = useState(false);

    useEffect(() => {
        if (!isLoading && value !== displayValue) {
            setIsAnimating(true);

            const startValue = displayValue;
            const endValue = value;
            const duration = 1000; // 1 second
            const startTime = Date.now();

            const animate = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);

                // Easing function for smooth animation
                const easeOutQuart = 1 - Math.pow(1 - progress, 4);
                const currentValue = startValue + (endValue - startValue) * easeOutQuart;

                setDisplayValue(currentValue);

                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    setIsAnimating(false);
                }
            };

            requestAnimationFrame(animate);
        }
    }, [isLoading, value, displayValue]);

    if (isLoading) {
        return (
            <Text
                color={color}
                fontSize={fontSize}
                fontWeight={fontWeight}
                opacity={0.6}
                filter="blur(1px)"
                transition="all 0.3s ease"
            >
                ---
            </Text>
        );
    }

    return (
        <ProgressiveLoader
            isLoading={false}
            delay={delay}
            animation="count-up"
        >
            <Text
                color={color}
                fontSize={fontSize}
                fontWeight={fontWeight}
                transform={isAnimating ? 'scale(1.05)' : 'scale(1)'}
                transition="transform 0.2s ease"
                dangerouslySetInnerHTML={{
                    __html: prefix + (formatValue ? formatValue(displayValue) : (isInteger ? Math.round(displayValue).toLocaleString() : displayValue.toLocaleString())) + suffix
                }}
            />
        </ProgressiveLoader>
    );
};

export default ProgressiveLoader;
