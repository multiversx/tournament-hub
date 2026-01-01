import React, { useState } from 'react';
import {
    Box,
    Button,
    Card,
    CardBody,
    CardHeader,
    Container,
    FormControl,
    FormLabel,
    Input,
    NumberInput,
    NumberInputField,
    VStack,
    Alert,
    AlertIcon,
    Text,
    HStack,
    Badge,
    Divider,
    SimpleGrid,
    Icon,
} from '@chakra-ui/react';
import { faCog, faGamepad, faUsers, faCoins, faClock, faEdit, faInfoCircle, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useWallet } from '../contexts/WalletContext';
import { useRegisterGameTransaction } from '../hooks/transactions/useRegisterGameTransaction';

interface GameRegistrationData {
    signingServerAddress: string;
    podiumSize: string;
    prizeDistributionPercentages: string[];
    allowLateJoin: boolean;
}

const Admin = () => {
    const { isConnected, address } = useWallet();
    const { registerGame } = useRegisterGameTransaction();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const [formData, setFormData] = useState<GameRegistrationData>({
        signingServerAddress: '',
        podiumSize: '3',
        prizeDistributionPercentages: ['5000', '3000', '2000'], // 50%, 30%, 20%
        allowLateJoin: false,
    });

    const handleInputChange = (field: keyof GameRegistrationData, value: string | boolean) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handlePrizeDistributionChange = (index: number, value: string) => {
        const newPercentages = [...formData.prizeDistributionPercentages];
        newPercentages[index] = value;
        setFormData(prev => ({
            ...prev,
            prizeDistributionPercentages: newPercentages
        }));
    };

    const addPrizePosition = () => {
        setFormData(prev => ({
            ...prev,
            prizeDistributionPercentages: [...prev.prizeDistributionPercentages, '0']
        }));
    };

    const removePrizePosition = (index: number) => {
        if (formData.prizeDistributionPercentages.length > 1) {
            const newPercentages = formData.prizeDistributionPercentages.filter((_, i) => i !== index);
            setFormData(prev => ({
                ...prev,
                prizeDistributionPercentages: newPercentages
            }));
        }
    };

    const validateForm = (): string | null => {
        if (!formData.signingServerAddress.trim()) {
            return 'Signing server address is required';
        }

        const podiumSize = parseInt(formData.podiumSize);
        if (podiumSize < 1 || podiumSize > 10) {
            return 'Podium size must be between 1 and 10';
        }

        if (formData.prizeDistributionPercentages.length !== podiumSize) {
            return 'Number of prize distribution percentages must match podium size';
        }

        const totalPercentage = formData.prizeDistributionPercentages.reduce((sum, p) => sum + parseInt(p || '0'), 0);
        if (totalPercentage !== 10000) {
            return 'Prize distribution percentages must sum to 10000 (100.00%)';
        }

        return null;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!isConnected) {
            setError('Please connect your wallet first');
            return;
        }

        const validationError = validateForm();
        if (validationError) {
            setError(validationError);
            return;
        }

        setIsLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const prizeDistributionNumbers = formData.prizeDistributionPercentages.map(p => parseInt(p));

            await registerGame({
                signingServerAddress: formData.signingServerAddress,
                podiumSize: parseInt(formData.podiumSize),
                prizeDistributionPercentages: prizeDistributionNumbers,
                allowLateJoin: formData.allowLateJoin,
            });

            setSuccess('Game registered successfully!');
            setFormData({
                signingServerAddress: '',
                podiumSize: '3',
                prizeDistributionPercentages: ['5000', '3000', '2000'],
                allowLateJoin: false,
            });
        } catch (err) {
            console.error('Error registering game:', err);
            setError(err instanceof Error ? err.message : 'Failed to register game');
        } finally {
            setIsLoading(false);
        }
    };

    if (!isConnected) {
        return (
            <Container maxW="container.xl" py={8}>
                <Card>
                    <CardBody>
                        <Alert status="warning">
                            <AlertIcon />
                            Please connect your wallet to access the admin panel.
                        </Alert>
                    </CardBody>
                </Card>
            </Container>
        );
    }

    return (
        <Container maxW="container.xl" py={8}>
            <VStack spacing={8} align="stretch">
                <Box>
                    <HStack spacing={4} mb={4}>
                        <Icon as={FontAwesomeIcon} icon={faCog} boxSize={6} color="purple.500" />
                        <Text fontSize="2xl" fontWeight="bold">
                            Admin Panel
                        </Text>
                    </HStack>
                    <Text color="gray.600">
                        Register new games for the tournament platform. Only the contract owner can register games.
                    </Text>
                </Box>

                <Card>
                    <CardHeader>
                        <HStack spacing={2}>
                            <Icon as={FontAwesomeIcon} icon={faGamepad} color="purple.500" />
                            <Text fontSize="lg" fontWeight="semibold">
                                Register New Game
                            </Text>
                        </HStack>
                    </CardHeader>
                    <CardBody>
                        <form onSubmit={handleSubmit}>
                            <VStack spacing={6} align="stretch">
                                {error && (
                                    <Alert status="error">
                                        <AlertIcon />
                                        {error}
                                    </Alert>
                                )}

                                {success && (
                                    <Alert status="success">
                                        <AlertIcon />
                                        {success}
                                    </Alert>
                                )}

                                <FormControl isRequired>
                                    <FormLabel>Signing Server Address</FormLabel>
                                    <Input
                                        value={formData.signingServerAddress}
                                        onChange={(e) => handleInputChange('signingServerAddress', e.target.value)}
                                        placeholder="erd1..."
                                        fontFamily="mono"
                                    />
                                </FormControl>

                                <FormControl isRequired>
                                    <FormLabel>Podium Size</FormLabel>
                                    <NumberInput
                                        value={formData.podiumSize}
                                        onChange={(value) => handleInputChange('podiumSize', value)}
                                        min={1}
                                        max={10}
                                    >
                                        <NumberInputField />
                                    </NumberInput>
                                </FormControl>

                                <FormControl isRequired>
                                    <FormLabel>Prize Distribution Percentages (in basis points, e.g., 5000 = 50%)</FormLabel>
                                    <VStack spacing={2} align="stretch">
                                        {formData.prizeDistributionPercentages.map((percentage, index) => (
                                            <HStack key={index}>
                                                <Text minW="100px">Position {index + 1}:</Text>
                                                <NumberInput
                                                    value={percentage}
                                                    onChange={(value) => handlePrizeDistributionChange(index, value)}
                                                    min={0}
                                                    max={10000}
                                                >
                                                    <NumberInputField />
                                                </NumberInput>
                                                <Text>bp</Text>
                                                {formData.prizeDistributionPercentages.length > 1 && (
                                                    <Button
                                                        size="sm"
                                                        colorScheme="red"
                                                        variant="outline"
                                                        onClick={() => removePrizePosition(index)}
                                                    >
                                                        Remove
                                                    </Button>
                                                )}
                                            </HStack>
                                        ))}
                                        <Button
                                            size="sm"
                                            colorScheme="blue"
                                            variant="outline"
                                            onClick={addPrizePosition}
                                        >
                                            Add Position
                                        </Button>
                                    </VStack>
                                    <Text fontSize="sm" color="gray.500" mt={2}>
                                        Total: {formData.prizeDistributionPercentages.reduce((sum, p) => sum + parseInt(p || '0'), 0)} / 10000
                                    </Text>
                                </FormControl>

                                <FormControl>
                                    <HStack>
                                        <input
                                            type="checkbox"
                                            id="allowLateJoin"
                                            checked={formData.allowLateJoin}
                                            onChange={(e) => handleInputChange('allowLateJoin', e.target.checked)}
                                        />
                                        <FormLabel htmlFor="allowLateJoin" mb={0}>
                                            Allow Late Join
                                        </FormLabel>
                                    </HStack>
                                </FormControl>

                                <Button
                                    type="submit"
                                    colorScheme="purple"
                                    size="lg"
                                    isLoading={isLoading}
                                    loadingText="Registering Game..."
                                    leftIcon={<FontAwesomeIcon icon={faGamepad} />}
                                >
                                    Register Game
                                </Button>
                            </VStack>
                        </form>
                    </CardBody>
                </Card>

                <Card>
                    <CardHeader>
                        <Text fontSize="lg" fontWeight="semibold">
                            Current Games
                        </Text>
                    </CardHeader>
                    <CardBody>
                        <Text color="gray.600">
                            Use the contract's getNumberOfGames() function to see registered games.
                        </Text>
                    </CardBody>
                </Card>
            </VStack>
        </Container>
    );
};

export default Admin;
