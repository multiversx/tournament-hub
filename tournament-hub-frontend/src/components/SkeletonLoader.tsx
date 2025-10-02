import React from 'react';
import {
    Box,
    Skeleton,
    SkeletonText,
    VStack,
    HStack,
    SimpleGrid,
    Card,
    CardBody,
    useColorModeValue,
} from '@chakra-ui/react';
import { keyframes } from '@emotion/react';

// Shimmer animation for skeleton loading
const shimmer = keyframes`
  0% { background-position: -200px 0; }
  100% { background-position: calc(200px + 100%) 0; }
`;

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
`;

export interface SkeletonLoaderProps {
    variant?: 'stat-card' | 'dashboard' | 'tournament-list' | 'user-stats';
    count?: number;
    enableShimmer?: boolean;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
    variant = 'stat-card',
    count = 1,
    enableShimmer = true,
}) => {
    const cardBg = useColorModeValue('gray.700', 'gray.800');
    const borderColor = useColorModeValue('gray.600', 'gray.700');

    const shimmerStyles = enableShimmer ? {
        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)',
        backgroundSize: '200px 100%',
        animation: `${shimmer} 1.5s ease-in-out infinite`,
    } : {};

    const pulseStyles = {
        animation: `${pulse} 2s ease-in-out infinite`,
    };

    if (variant === 'stat-card') {
        return (
            <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={6}>
                {Array.from({ length: count }).map((_, index) => (
                    <Card
                        key={index}
                        bg={cardBg}
                        border="1px solid"
                        borderColor={borderColor}
                        {...shimmerStyles}
                    >
                        <CardBody>
                            <VStack spacing={3} align="stretch">
                                <Skeleton height="16px" width="60%" {...pulseStyles} />
                                <Skeleton height="32px" width="40%" {...pulseStyles} />
                                <Skeleton height="12px" width="80%" {...pulseStyles} />
                            </VStack>
                        </CardBody>
                    </Card>
                ))}
            </SimpleGrid>
        );
    }

    if (variant === 'dashboard') {
        return (
            <VStack spacing={8} align="stretch">
                {/* Header skeleton */}
                <HStack justify="space-between" align="start">
                    <VStack spacing={4} align="start">
                        <Skeleton height="40px" width="200px" {...pulseStyles} />
                        <Skeleton height="20px" width="300px" {...pulseStyles} />
                    </VStack>
                    <Skeleton height="36px" width="120px" borderRadius="md" {...pulseStyles} />
                </HStack>

                {/* Stats grid skeleton */}
                <SkeletonLoader variant="stat-card" count={4} enableShimmer={enableShimmer} />

                {/* User stats skeleton */}
                <Card bg={cardBg} border="1px solid" borderColor={borderColor} {...shimmerStyles}>
                    <CardBody>
                        <VStack spacing={4} align="stretch">
                            <HStack spacing={3}>
                                <Skeleton height="24px" width="24px" borderRadius="full" {...pulseStyles} />
                                <VStack spacing={2} align="start">
                                    <Skeleton height="20px" width="150px" {...pulseStyles} />
                                    <Skeleton height="16px" width="200px" {...pulseStyles} />
                                </VStack>
                            </HStack>
                            <SimpleGrid columns={{ base: 2, md: 4, lg: 6 }} spacing={6}>
                                {Array.from({ length: 6 }).map((_, index) => (
                                    <VStack key={index} spacing={2}>
                                        <Skeleton height="14px" width="80%" {...pulseStyles} />
                                        <Skeleton height="24px" width="60%" {...pulseStyles} />
                                        <Skeleton height="12px" width="90%" {...pulseStyles} />
                                    </VStack>
                                ))}
                            </SimpleGrid>
                        </VStack>
                    </CardBody>
                </Card>
            </VStack>
        );
    }

    if (variant === 'user-stats') {
        return (
            <SimpleGrid columns={{ base: 2, md: 4, lg: 6 }} spacing={6}>
                {Array.from({ length: count }).map((_, index) => (
                    <VStack key={index} spacing={2}>
                        <Skeleton height="14px" width="80%" {...pulseStyles} />
                        <Skeleton height="24px" width="60%" {...pulseStyles} />
                        <Skeleton height="12px" width="90%" {...pulseStyles} />
                    </VStack>
                ))}
            </SimpleGrid>
        );
    }

    return null;
};

// Specialized skeleton components
export const StatCardSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => (
    <SkeletonLoader variant="stat-card" count={count} />
);

export const DashboardSkeleton: React.FC = () => (
    <SkeletonLoader variant="dashboard" />
);

export const UserStatsSkeleton: React.FC<{ count?: number }> = ({ count = 6 }) => (
    <SkeletonLoader variant="user-stats" count={count} />
);

export default SkeletonLoader;
