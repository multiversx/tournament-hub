import React from 'react';
import { render, screen } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { Leaderboard } from './Leaderboard';

// Mock the dependencies
jest.mock('lib', () => ({
    useGetAccountInfo: () => ({ address: 'test-address' })
}));

jest.mock('../../helpers', () => ({
    getAllPlayersStats: jest.fn(() => Promise.resolve([]))
}));

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
    <ChakraProvider>
        {children}
    </ChakraProvider>
);

describe('Leaderboard Component', () => {
    test('renders without crashing', () => {
        render(
            <TestWrapper>
                <Leaderboard />
            </TestWrapper>
        );

        // Should show loading state initially
        expect(screen.getByText('Leaderboard')).toBeInTheDocument();
    });
});

