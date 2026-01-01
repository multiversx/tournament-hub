import React from 'react';
import { Box, Skeleton, VStack, HStack, SimpleGrid } from '@chakra-ui/react';

interface TournamentCardSkeletonProps {
    count?: number;
    columns?: number;
}

export const TournamentCardSkeleton: React.FC<TournamentCardSkeletonProps> = ({
    count = 6,
    columns = 3
}) => {
    return (
        <SimpleGrid columns={columns} spacing={8}>
            {Array.from({ length: count }).map((_, index) => (
                <Box
                    key={index}
                    bg="gray.800"
                    border="1px solid"
                    borderColor="gray.700"
                    borderRadius="2xl"
                    p={6}
                    transition="all 0.3s"
                >
                    <VStack spacing={4} align="stretch">
                        {/* Header */}
                        <HStack justify="space-between">
                            <HStack spacing={3}>
                                <Skeleton height="40px" width="40px" borderRadius="lg" />
                                <VStack spacing={2} align="start">
                                    <Skeleton height="20px" width="120px" />
                                    <Skeleton height="16px" width="80px" />
                                </VStack>
                            </HStack>
                            <Skeleton height="24px" width="80px" borderRadius="lg" />
                        </HStack>

                        {/* Description */}
                        <Skeleton height="16px" width="100%" />
                        <Skeleton height="16px" width="80%" />

                        {/* Stats */}
                        <SimpleGrid columns={2} spacing={4}>
                            <VStack spacing={1} align="start">
                                <Skeleton height="12px" width="60px" />
                                <Skeleton height="16px" width="80px" />
                            </VStack>
                            <VStack spacing={1} align="start">
                                <Skeleton height="12px" width="60px" />
                                <Skeleton height="16px" width="60px" />
                            </VStack>
                        </SimpleGrid>

                        {/* Progress Bar */}
                        <VStack spacing={2} align="stretch">
                            <HStack justify="space-between">
                                <Skeleton height="12px" width="50px" />
                                <Skeleton height="12px" width="40px" />
                            </HStack>
                            <Skeleton height="8px" width="100%" borderRadius="full" />
                            <Skeleton height="12px" width="100px" />
                        </VStack>

                        {/* Footer */}
                        <HStack justify="space-between">
                            <Skeleton height="16px" width="80px" />
                            <Skeleton height="32px" width="100px" borderRadius="lg" />
                        </HStack>
                    </VStack>
                </Box>
            ))}
        </SimpleGrid>
    );
};
