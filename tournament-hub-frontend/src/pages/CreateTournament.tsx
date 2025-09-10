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
    Heading,
    Input,
    NumberInput,
    NumberInputField,
    Textarea,
    VStack,
    Alert,
    AlertIcon,
    Text,
    Select,
    HStack,
    Badge,
    Divider,
    SimpleGrid,
    Icon,
    Slider,
    SliderTrack,
    SliderFilledTrack,
    SliderThumb,
    SliderMark,
} from '@chakra-ui/react';
import { faPlus, faGamepad, faUsers, faCoins, faClock, faEdit, faInfoCircle, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useWallet } from '../contexts/WalletContext';
import { useCreateTournamentTransaction } from '../hooks/transactions/useCreateTournamentTransaction';
import { GAME_CONFIGS } from '../services/tournamentService';

interface FormData {
    name: string;
    gameType: string;
    maxPlayers: string;
    minPlayers: string;
    entryFee: string;
}

interface FormErrors {
    name?: string;
    gameType?: string;
    maxPlayers?: string;
    minPlayers?: string;
    entryFee?: string;
}


export const CreateTournament: React.FC = () => {
    const { isConnected, address } = useWallet();
    const { createTournament } = useCreateTournamentTransaction();

    const [formData, setFormData] = useState<FormData>({
        name: '',
        gameType: '1', // Default to TicTacToe (PvP)
        maxPlayers: '2',
        minPlayers: '2', // PvP locked to 2
        entryFee: '0.1',
    });

    const [errors, setErrors] = useState<FormErrors>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Prize Pool Slider Configuration
    const prizePoolSteps = ['0.01', '0.05', '0.1', '0.25', '0.5', '1', '2', '5', '10', '25', '50', '100'];
    const [prizePoolSliderValue, setPrizePoolSliderValue] = useState(2); // Default to index 2 (0.1 EGLD)
    const [isManualInput, setIsManualInput] = useState(false); // Track if user is manually typing

    // Convert between slider value (0-11) and actual EGLD amount using direct array indexing
    const getSliderValueFromAmount = (amount: number) => {
        // Find the closest step value
        let closestIndex = 0;
        let minDifference = Math.abs(amount - parseFloat(prizePoolSteps[0]));

        for (let i = 1; i < prizePoolSteps.length; i++) {
            const stepValue = parseFloat(prizePoolSteps[i]);
            const difference = Math.abs(amount - stepValue);
            if (difference < minDifference) {
                minDifference = difference;
                closestIndex = i;
            }
        }

        return closestIndex;
    };

    const getAmountFromSliderValue = (sliderValue: number) => {
        const index = Math.round(sliderValue);
        return parseFloat(prizePoolSteps[index] || prizePoolSteps[0]);
    };

    // Slider state for better UX
    const [sliderValues, setSliderValues] = useState([2, 2]); // [min, max]

    // Ensure PvP games (TicTacToe=1, Chess=2, ColorRush=4) always show 2/2 even on initial load
    React.useEffect(() => {
        const gameId = parseInt(formData.gameType);
        if ((gameId === 1 || gameId === 2 || gameId === 4) && (formData.maxPlayers !== '2' || formData.minPlayers !== '2')) {
            setFormData(prev => ({ ...prev, maxPlayers: '2', minPlayers: '2' }));
            setSliderValues([2, 2]);
        }
    }, [formData.gameType]);

    // Sync slider values with form data
    React.useEffect(() => {
        setSliderValues([parseInt(formData.minPlayers), parseInt(formData.maxPlayers)]);
    }, [formData.minPlayers, formData.maxPlayers]);

    const validateForm = (): boolean => {
        const newErrors: FormErrors = {};

        if (!formData.name.trim()) {
            newErrors.name = 'Tournament name is required';
        } else if (formData.name.length > 100) {
            newErrors.name = 'Name must be at most 100 characters';
        }

        if (!formData.gameType) {
            newErrors.gameType = 'Please select a game type';
        }

        const maxPlayers = parseInt(formData.maxPlayers);
        if (!maxPlayers || maxPlayers < 2 || maxPlayers > 8) {
            newErrors.maxPlayers = 'Max players must be between 2 and 8';
        }

        const minPlayers = parseInt(formData.minPlayers);
        if (!minPlayers || minPlayers < 2 || minPlayers > maxPlayers) {
            newErrors.minPlayers = 'Min players must be between 2 and max players';
        }

        const entryFee = parseFloat(formData.entryFee);
        if (isNaN(entryFee) || entryFee < 0) {
            newErrors.entryFee = 'Entry fee must be a positive number';
        }


        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!isConnected) {
            return;
        }

        if (!validateForm()) {
            return;
        }

        setIsSubmitting(true);

        try {
            // Debug logging
            // Creating tournament...

            const sessionId = await createTournament({
                gameId: parseInt(formData.gameType),
                maxPlayers: parseInt(formData.maxPlayers),
                minPlayers: parseInt(formData.minPlayers),
                entryFee: formData.entryFee,
                name: formData.name.trim(),
            });


            // Reset form
            setFormData({
                name: '',
                gameType: '1',
                maxPlayers: '4',
                minPlayers: '2',
                entryFee: '0.1',
            });
        } catch (error) {
            console.error('Error creating tournament:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleInputChange = (field: keyof FormData, value: string) => {
        // Force PvP (Chess) to 2 players only
        const gameId = field === 'gameType' ? parseInt(value) : parseInt(formData.gameType);
        const isPvpTwoPlayer = gameId === 2 || gameId === 1; // 2 = Chess, 1 = TicTacToe
        let next = { ...formData, [field]: value } as FormData;
        if (isPvpTwoPlayer) {
            next.maxPlayers = '2';
            next.minPlayers = '2';
        }
        setFormData(next);
        // Clear error when user starts typing
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: undefined }));
        }
    };

    const handlePrizePoolChange = (value: number) => {
        setPrizePoolSliderValue(value);
        const entryFeeValue = getAmountFromSliderValue(value).toFixed(4);
        setFormData(prev => ({ ...prev, entryFee: entryFeeValue }));
        // Clear error when user changes slider
        if (errors.entryFee) {
            setErrors(prev => ({ ...prev, entryFee: undefined }));
        }
        // Reset manual input flag when slider changes
        setIsManualInput(false);
    };

    const handleSliderChange = (values: number[]) => {
        const [min, max] = values;
        setSliderValues(values);
        setFormData(prev => ({
            ...prev,
            minPlayers: min.toString(),
            maxPlayers: max.toString()
        }));
        // Clear errors
        if (errors.minPlayers || errors.maxPlayers) {
            setErrors(prev => ({ ...prev, minPlayers: undefined, maxPlayers: undefined }));
        }
    };

    const handleRangeSliderMouseDown = (e: React.MouseEvent, type: 'min' | 'max' | 'track') => {
        if (parseInt(formData.gameType) === 2 || parseInt(formData.gameType) === 1 || parseInt(formData.gameType) === 4) {
            return; // Disabled for PvP games
        }

        e.preventDefault();
        const rect = e.currentTarget.getBoundingClientRect();
        const sliderWidth = rect.width;
        const clickX = e.clientX - rect.left;
        const percentage = clickX / sliderWidth;
        const newValue = Math.round(2 + percentage * 6); // 2-8 range
        const clampedValue = Math.max(2, Math.min(8, newValue));

        if (type === 'min') {
            const newValues = [clampedValue, Math.max(clampedValue, sliderValues[1])];
            handleSliderChange(newValues);
        } else if (type === 'max') {
            const newValues = [Math.min(clampedValue, sliderValues[0]), clampedValue];
            handleSliderChange(newValues);
        } else if (type === 'track') {
            // Click on track - move the closest handle
            const distanceToMin = Math.abs(clampedValue - sliderValues[0]);
            const distanceToMax = Math.abs(clampedValue - sliderValues[1]);

            if (distanceToMin < distanceToMax) {
                const newValues = [clampedValue, Math.max(clampedValue, sliderValues[1])];
                handleSliderChange(newValues);
            } else {
                const newValues = [Math.min(clampedValue, sliderValues[0]), clampedValue];
                handleSliderChange(newValues);
            }
        }

        // Add mouse move and mouse up listeners
        const handleMouseMove = (moveEvent: MouseEvent) => {
            const moveRect = e.currentTarget.getBoundingClientRect();
            const moveSliderWidth = moveRect.width;
            const moveClickX = moveEvent.clientX - moveRect.left;
            const movePercentage = moveClickX / moveSliderWidth;
            const moveNewValue = Math.round(2 + movePercentage * 6);
            const moveClampedValue = Math.max(2, Math.min(8, moveNewValue));

            if (type === 'min') {
                const newValues = [moveClampedValue, Math.max(moveClampedValue, sliderValues[1])];
                handleSliderChange(newValues);
            } else if (type === 'max') {
                const newValues = [Math.min(moveClampedValue, sliderValues[0]), moveClampedValue];
                handleSliderChange(newValues);
            }
        };

        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    const getSelectedGameConfig = () => {
        const gameId = parseInt(formData.gameType);
        return GAME_CONFIGS[gameId as keyof typeof GAME_CONFIGS];
    };

    const selectedGame = getSelectedGameConfig();

    return (
        <Container maxW="container.lg" py={8}>
            <VStack spacing={6} align="stretch">
                {/* Cool Header with Gradient */}
                <Box textAlign="center" position="relative">
                    <Box
                        position="absolute"
                        top="-50%"
                        left="50%"
                        transform="translateX(-50%)"
                        w="200%"
                        h="200%"
                        bgGradient="radial(circle, rgba(59, 130, 246, 0.1) 0%, transparent 70%)"
                        borderRadius="full"
                        zIndex={0}
                    />
                    <VStack spacing={3} position="relative" zIndex={1}>
                        <Box
                            p={4}
                            bgGradient="linear(135deg, blue.500, purple.600, pink.500)"
                            borderRadius="2xl"
                            boxShadow="0 20px 40px rgba(59, 130, 246, 0.3)"
                            _hover={{
                                transform: "translateY(-2px)",
                                boxShadow: "0 25px 50px rgba(59, 130, 246, 0.4)"
                            }}
                            transition="all 0.3s ease"
                        >
                            <Heading size="xl" color="white" textShadow="0 2px 4px rgba(0,0,0,0.3)">
                                Create New Tournament
                            </Heading>
                        </Box>
                    </VStack>
                </Box>


                {/* Cool Main Form Card */}
                <Card
                    bgGradient="linear(135deg, gray.800, gray.900)"
                    borderRadius="2xl"
                    border="1px solid"
                    borderColor="gray.600"
                    boxShadow="0 20px 40px rgba(0,0,0,0.3)"
                    position="relative"
                    overflow="hidden"
                    _hover={{
                        boxShadow: "0 25px 50px rgba(0,0,0,0.4)"
                    }}
                    transition="all 0.3s ease"
                >
                    {/* Animated Background */}
                    <Box
                        position="absolute"
                        top={0}
                        left={0}
                        right={0}
                        h="4px"
                        bgGradient="linear(90deg, blue.500, purple.500, pink.500, blue.500)"
                        backgroundSize="200% 100%"
                        animation="gradient 3s ease infinite"
                        sx={{
                            '@keyframes gradient': {
                                '0%': { backgroundPosition: '0% 50%' },
                                '50%': { backgroundPosition: '100% 50%' },
                                '100%': { backgroundPosition: '0% 50%' }
                            }
                        }}
                    />

                    <CardHeader pb={4}>
                        <HStack spacing={3}>
                            <Box
                                p={2}
                                bgGradient="linear(135deg, blue.500, purple.600)"
                                borderRadius="xl"
                                boxShadow="0 8px 20px rgba(59, 130, 246, 0.3)"
                            >
                                <FontAwesomeIcon icon={faEdit} color="white" size="lg" />
                            </Box>
                            <VStack spacing={1} align="start">
                                <Heading size="md" color="white" fontWeight="bold">
                                    Tournament Details
                                </Heading>
                                <Text color="gray.400" fontSize="xs">
                                    Configure your tournament settings
                                </Text>
                            </VStack>
                        </HStack>
                    </CardHeader>
                    <CardBody p={6}>
                        <form onSubmit={handleSubmit}>
                            <VStack spacing={3} pb={4}>
                                {/* Top Row: Tournament Name and Game Type */}
                                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6} w="full">
                                    <FormControl isInvalid={!!errors.name}>
                                        <FormLabel
                                            color="white"
                                            fontSize="sm"
                                            fontWeight="semibold"
                                            mb={2}
                                        >
                                            <HStack spacing={2}>
                                                <Box
                                                    p={1}
                                                    bgGradient="linear(135deg, blue.500, purple.600)"
                                                    borderRadius="md"
                                                >
                                                    <FontAwesomeIcon icon={faEdit} color="white" size="sm" />
                                                </Box>
                                                Tournament Name
                                            </HStack>
                                        </FormLabel>
                                        <Input
                                            value={formData.name}
                                            onChange={(e) => handleInputChange('name', e.target.value)}
                                            placeholder="Enter tournament name"
                                            size="md"
                                            bg="gray.700"
                                            border="2px solid"
                                            borderColor="gray.600"
                                            borderRadius="xl"
                                            _hover={{
                                                borderColor: "blue.400",
                                                transform: "translateY(-1px)",
                                                boxShadow: "0 4px 12px rgba(59, 130, 246, 0.2)"
                                            }}
                                            _focus={{
                                                borderColor: "blue.500",
                                                boxShadow: "0 0 0 3px rgba(59, 130, 246, 0.1)",
                                                transform: "translateY(-1px)"
                                            }}
                                            _invalid={{
                                                borderColor: "red.400",
                                                boxShadow: "0 0 0 3px rgba(239, 68, 68, 0.1)"
                                            }}
                                            sx={{
                                                color: 'white !important',
                                                '&::placeholder': { color: 'gray.400' }
                                            }}
                                            transition="all 0.2s ease"
                                        />
                                        {errors.name && (
                                            <Text color="red.400" fontSize="xs" mt={1} fontWeight="medium">
                                                {errors.name}
                                            </Text>
                                        )}
                                    </FormControl>

                                    <FormControl isInvalid={!!errors.gameType}>
                                        <FormLabel
                                            color="white"
                                            fontSize="sm"
                                            fontWeight="semibold"
                                            mb={2}
                                        >
                                            <HStack spacing={2}>
                                                <Box
                                                    p={1}
                                                    bgGradient="linear(135deg, green.500, emerald.600)"
                                                    borderRadius="md"
                                                >
                                                    <FontAwesomeIcon icon={faGamepad} color="white" size="sm" />
                                                </Box>
                                                Game Type
                                            </HStack>
                                        </FormLabel>
                                        <Select
                                            value={formData.gameType}
                                            onChange={(e) => handleInputChange('gameType', e.target.value)}
                                            size="md"
                                            bg="gray.700"
                                            border="2px solid"
                                            borderColor="gray.600"
                                            borderRadius="xl"
                                            _hover={{
                                                borderColor: "green.400",
                                                transform: "translateY(-1px)",
                                                boxShadow: "0 4px 12px rgba(34, 197, 94, 0.2)"
                                            }}
                                            _focus={{
                                                borderColor: "green.500",
                                                boxShadow: "0 0 0 3px rgba(34, 197, 94, 0.1)",
                                                transform: "translateY(-1px)"
                                            }}
                                            _invalid={{
                                                borderColor: "red.400",
                                                boxShadow: "0 0 0 3px rgba(239, 68, 68, 0.1)"
                                            }}
                                            sx={{
                                                color: 'white !important',
                                                '& option': {
                                                    backgroundColor: 'gray.700',
                                                    color: 'white'
                                                }
                                            }}
                                            transition="all 0.2s ease"
                                        >
                                            {Object.entries(GAME_CONFIGS).map(([id, config]) => (
                                                <option key={id} value={id}>
                                                    {config.name}
                                                </option>
                                            ))}
                                        </Select>
                                        {errors.gameType && (
                                            <Text color="red.400" fontSize="xs" mt={1} fontWeight="medium">
                                                {errors.gameType}
                                            </Text>
                                        )}
                                    </FormControl>
                                </SimpleGrid>

                                {/* Cool Game Configuration Preview */}
                                {selectedGame && (
                                    <Box
                                        bgGradient="linear(135deg, gray.700, gray.800)"
                                        border="2px solid"
                                        borderColor="gray.600"
                                        borderRadius="xl"
                                        p={4}
                                        boxShadow="0 8px 20px rgba(0,0,0,0.2)"
                                        _hover={{
                                            borderColor: "purple.400",
                                            transform: "translateY(-2px)",
                                            boxShadow: "0 12px 25px rgba(147, 51, 234, 0.2)"
                                        }}
                                        transition="all 0.3s ease"
                                    >
                                        <HStack justify="space-between" align="center">
                                            <HStack spacing={3}>
                                                <Badge
                                                    colorScheme="blue"
                                                    fontSize="sm"
                                                    px={3}
                                                    py={1}
                                                    borderRadius="full"
                                                    bgGradient="linear(135deg, blue.500, blue.600)"
                                                    color="white"
                                                    fontWeight="bold"
                                                    boxShadow="0 4px 12px rgba(59, 130, 246, 0.3)"
                                                >
                                                    {selectedGame.name}
                                                </Badge>
                                                <Badge
                                                    colorScheme="green"
                                                    fontSize="sm"
                                                    px={3}
                                                    py={1}
                                                    borderRadius="full"
                                                    bgGradient="linear(135deg, green.500, emerald.600)"
                                                    color="white"
                                                    fontWeight="bold"
                                                    boxShadow="0 4px 12px rgba(34, 197, 94, 0.3)"
                                                >
                                                    {selectedGame.gameType}
                                                </Badge>
                                            </HStack>
                                            <HStack spacing={2}>
                                                <Box
                                                    p={1}
                                                    bgGradient="linear(135deg, purple.500, pink.600)"
                                                    borderRadius="md"
                                                >
                                                    <FontAwesomeIcon icon={faUsers} color="white" size="sm" />
                                                </Box>
                                                <Text color="white" fontSize="sm" fontWeight="semibold">
                                                    Players: {sliderValues[0]}-{sliderValues[1]}
                                                </Text>
                                            </HStack>
                                        </HStack>
                                    </Box>
                                )}

                                {/* Cool Player Range Slider */}
                                <FormControl isInvalid={!!errors.minPlayers || !!errors.maxPlayers}>
                                    <FormLabel
                                        color="white"
                                        fontSize="lg"
                                        fontWeight="bold"
                                        mb={4}
                                        textAlign="center"
                                    >
                                        <HStack spacing={3} justify="center">
                                            <Box
                                                p={2}
                                                bgGradient="linear(135deg, purple.500, pink.600)"
                                                borderRadius="xl"
                                                boxShadow="0 8px 20px rgba(147, 51, 234, 0.3)"
                                            >
                                                <FontAwesomeIcon icon={faUsers} color="white" size="lg" />
                                            </Box>
                                            <VStack spacing={0} align="center">
                                                <Text>Player Range</Text>
                                                <Text color="gray.400" fontSize="sm">
                                                    Drag the handles to set min and max players
                                                </Text>
                                            </VStack>
                                        </HStack>
                                    </FormLabel>

                                    <Box
                                        bg="gray.700"
                                        borderRadius="2xl"
                                        p={6}
                                        border="2px solid"
                                        borderColor="gray.600"
                                        _hover={{
                                            borderColor: "purple.400",
                                            boxShadow: "0 8px 25px rgba(147, 51, 234, 0.2)"
                                        }}
                                        transition="all 0.3s ease"
                                    >
                                        <VStack spacing={6}>
                                            {/* Current Values Display */}
                                            <HStack spacing={8} justify="center">
                                                <VStack spacing={1}>
                                                    <Text color="purple.300" fontSize="sm" fontWeight="semibold">
                                                        Min Players
                                                    </Text>
                                                    <Box
                                                        bgGradient="linear(135deg, purple.500, pink.600)"
                                                        color="white"
                                                        px={4}
                                                        py={2}
                                                        borderRadius="xl"
                                                        fontWeight="bold"
                                                        fontSize="lg"
                                                        boxShadow="0 4px 12px rgba(147, 51, 234, 0.3)"
                                                    >
                                                        {sliderValues[0]}
                                                    </Box>
                                                </VStack>
                                                <VStack spacing={1}>
                                                    <Text color="pink.300" fontSize="sm" fontWeight="semibold">
                                                        Max Players
                                                    </Text>
                                                    <Box
                                                        bgGradient="linear(135deg, pink.500, purple.600)"
                                                        color="white"
                                                        px={4}
                                                        py={2}
                                                        borderRadius="xl"
                                                        fontWeight="bold"
                                                        fontSize="lg"
                                                        boxShadow="0 4px 12px rgba(236, 72, 153, 0.3)"
                                                    >
                                                        {sliderValues[1]}
                                                    </Box>
                                                </VStack>
                                            </HStack>

                                            {/* Dual Handle Range Slider */}
                                            <Box w="full" px={4}>
                                                <VStack spacing={6}>
                                                    {/* Range Display */}
                                                    <HStack spacing={4} justify="center">
                                                        <Box
                                                            bgGradient="linear(135deg, purple.500, purple.600)"
                                                            color="white"
                                                            px={4}
                                                            py={2}
                                                            borderRadius="xl"
                                                            fontWeight="bold"
                                                            fontSize="lg"
                                                            boxShadow="0 4px 12px rgba(147, 51, 234, 0.3)"
                                                        >
                                                            {sliderValues[0]} - {sliderValues[1]} Players
                                                        </Box>
                                                    </HStack>

                                                    {/* Custom Range Slider */}
                                                    <Box position="relative" w="full" h="8">
                                                        {/* Track Background */}
                                                        <Box
                                                            position="absolute"
                                                            top="50%"
                                                            left="0"
                                                            right="0"
                                                            h="8px"
                                                            bg="gray.600"
                                                            borderRadius="full"
                                                            transform="translateY(-50%)"
                                                            boxShadow="inset 0 2px 4px rgba(0,0,0,0.2)"
                                                        />

                                                        {/* Active Range */}
                                                        <Box
                                                            position="absolute"
                                                            top="50%"
                                                            left={`${((sliderValues[0] - 2) / 6) * 100}%`}
                                                            right={`${((8 - sliderValues[1]) / 6) * 100}%`}
                                                            h="8px"
                                                            bgGradient="linear(90deg, purple.500, pink.500)"
                                                            borderRadius="full"
                                                            transform="translateY(-50%)"
                                                            boxShadow="0 2px 8px rgba(147, 51, 234, 0.4)"
                                                        />

                                                        {/* Min Handle */}
                                                        <Box
                                                            position="absolute"
                                                            top="50%"
                                                            left={`${((sliderValues[0] - 2) / 6) * 100}%`}
                                                            transform="translate(-50%, -50%)"
                                                            w="8"
                                                            h="8"
                                                            bgGradient="linear(135deg, purple.500, purple.600)"
                                                            borderRadius="full"
                                                            border="3px solid"
                                                            borderColor="white"
                                                            boxShadow="0 4px 12px rgba(147, 51, 234, 0.4), 0 0 0 1px rgba(147, 51, 234, 0.2)"
                                                            cursor="pointer"
                                                            _hover={{
                                                                transform: "translate(-50%, -50%) scale(1.2)",
                                                                boxShadow: "0 6px 16px rgba(147, 51, 234, 0.6), 0 0 0 1px rgba(147, 51, 234, 0.3)"
                                                            }}
                                                            _active={{
                                                                transform: "translate(-50%, -50%) scale(1.1)"
                                                            }}
                                                            transition="all 0.2s ease"
                                                            onMouseDown={(e) => handleRangeSliderMouseDown(e, 'min')}
                                                        >
                                                            <Box
                                                                color="white"
                                                                fontSize="xs"
                                                                fontWeight="bold"
                                                                position="absolute"
                                                                top="-20px"
                                                                left="50%"
                                                                transform="translateX(-50%)"
                                                                whiteSpace="nowrap"
                                                            >
                                                                {sliderValues[0]}
                                                            </Box>
                                                        </Box>

                                                        {/* Max Handle */}
                                                        <Box
                                                            position="absolute"
                                                            top="50%"
                                                            left={`${((sliderValues[1] - 2) / 6) * 100}%`}
                                                            transform="translate(-50%, -50%)"
                                                            w="8"
                                                            h="8"
                                                            bgGradient="linear(135deg, pink.500, pink.600)"
                                                            borderRadius="full"
                                                            border="3px solid"
                                                            borderColor="white"
                                                            boxShadow="0 4px 12px rgba(236, 72, 153, 0.4), 0 0 0 1px rgba(236, 72, 153, 0.2)"
                                                            cursor="pointer"
                                                            _hover={{
                                                                transform: "translate(-50%, -50%) scale(1.2)",
                                                                boxShadow: "0 6px 16px rgba(236, 72, 153, 0.6), 0 0 0 1px rgba(236, 72, 153, 0.3)"
                                                            }}
                                                            _active={{
                                                                transform: "translate(-50%, -50%) scale(1.1)"
                                                            }}
                                                            transition="all 0.2s ease"
                                                            onMouseDown={(e) => handleRangeSliderMouseDown(e, 'max')}
                                                        >
                                                            <Box
                                                                color="white"
                                                                fontSize="xs"
                                                                fontWeight="bold"
                                                                position="absolute"
                                                                top="-20px"
                                                                left="50%"
                                                                transform="translateX(-50%)"
                                                                whiteSpace="nowrap"
                                                            >
                                                                {sliderValues[1]}
                                                            </Box>
                                                        </Box>

                                                        {/* Clickable Track */}
                                                        <Box
                                                            position="absolute"
                                                            top="0"
                                                            left="0"
                                                            right="0"
                                                            h="8"
                                                            cursor="pointer"
                                                            onMouseDown={(e) => handleRangeSliderMouseDown(e, 'track')}
                                                        />
                                                    </Box>

                                                    {/* Slider Marks */}
                                                    <HStack spacing={0} justify="space-between" w="full" px={2}>
                                                        {[2, 3, 4, 5, 6, 7, 8].map((value) => (
                                                            <Text
                                                                key={value}
                                                                color="gray.400"
                                                                fontSize="xs"
                                                                fontWeight="semibold"
                                                                textAlign="center"
                                                                minW="20px"
                                                            >
                                                                {value}
                                                            </Text>
                                                        ))}
                                                    </HStack>
                                                </VStack>
                                            </Box>
                                        </VStack>
                                    </Box>

                                    {(errors.minPlayers || errors.maxPlayers) && (
                                        <Text color="red.400" fontSize="xs" mt={2} textAlign="center" fontWeight="medium">
                                            {errors.minPlayers || errors.maxPlayers}
                                        </Text>
                                    )}
                                </FormControl>

                                {/* Turn-based Games Info Message */}
                                {selectedGame && (selectedGame.gameType === 'TURN_BASED' || selectedGame.gameType === 'PvP') && (
                                    <Box
                                        bgGradient="linear(135deg, blue.500, blue.600)"
                                        border="2px solid"
                                        borderColor="blue.400"
                                        borderRadius="xl"
                                        p={4}
                                        boxShadow="0 8px 20px rgba(59, 130, 246, 0.2)"
                                    >
                                        <HStack spacing={3} align="center">
                                            <Box
                                                p={2}
                                                bg="rgba(255,255,255,0.2)"
                                                borderRadius="md"
                                            >
                                                <FontAwesomeIcon icon={faInfoCircle} color="white" size="sm" />
                                            </Box>
                                            <VStack spacing={1} align="start">
                                                <Text color="white" fontSize="sm" fontWeight="bold">
                                                    Turn-based Games
                                                </Text>
                                                <Text color="blue.100" fontSize="xs">
                                                    Turn-based games are exclusively designed for head-to-head competition and require exactly 2 players.
                                                </Text>
                                            </VStack>
                                        </HStack>
                                    </Box>
                                )}

                                {/* PvP Game Mode Info */}
                                {(parseInt(formData.gameType) === 2 || parseInt(formData.gameType) === 1 || parseInt(formData.gameType) === 4) && (
                                    <Box
                                        bgGradient="linear(135deg, purple.500, pink.600)"
                                        borderRadius="xl"
                                        p={4}
                                        boxShadow="0 8px 20px rgba(147, 51, 234, 0.3)"
                                        border="2px solid"
                                        borderColor="purple.400"
                                    >
                                        <HStack spacing={3}>
                                            <Box
                                                p={2}
                                                bg="white"
                                                borderRadius="full"
                                                boxShadow="0 4px 12px rgba(0,0,0,0.2)"
                                            >
                                                <FontAwesomeIcon icon={faUsers} color="#8B5CF6" size="lg" />
                                            </Box>
                                            <VStack spacing={1} align="start">
                                                <Text color="white" fontSize="sm" fontWeight="bold">
                                                    PvP Game Mode
                                                </Text>
                                                <Text color="purple.100" fontSize="xs">
                                                    Min and Max players are fixed to 2 for this game type
                                                </Text>
                                            </VStack>
                                        </HStack>
                                    </Box>
                                )}

                                {/* Entry Fee Input */}
                                <FormControl isInvalid={!!errors.entryFee}>
                                    <FormLabel
                                        color="white"
                                        fontSize="sm"
                                        fontWeight="semibold"
                                        mb={2}
                                    >
                                        <HStack spacing={2}>
                                            <Box
                                                p={1}
                                                bgGradient="linear(135deg, yellow.500, orange.600)"
                                                borderRadius="md"
                                            >
                                                <FontAwesomeIcon icon={faCoins} color="white" size="sm" />
                                            </Box>
                                            Entry Fee (EGLD)
                                        </HStack>
                                    </FormLabel>
                                    {/* Prize Pool Slider with Logarithmic Values */}
                                    <Box position="relative">
                                        <Slider
                                            value={prizePoolSliderValue}
                                            onChange={handlePrizePoolChange}
                                            min={0}
                                            max={prizePoolSteps.length - 1}
                                            step={1}
                                            size="lg"
                                        >
                                            <SliderTrack
                                                bg="gray.700"
                                                borderRadius="xl"
                                                h="8px"
                                                _before={{
                                                    content: '""',
                                                    position: 'absolute',
                                                    top: 0,
                                                    left: 0,
                                                    right: 0,
                                                    bottom: 0,
                                                    bg: 'linear-gradient(90deg, yellow.400, orange.500, yellow.400)',
                                                    borderRadius: 'xl',
                                                    opacity: 0.3
                                                }}
                                            >
                                                <SliderFilledTrack
                                                    bgGradient="linear(90deg, yellow.400, orange.500)"
                                                    borderRadius="xl"
                                                />
                                            </SliderTrack>
                                            <SliderThumb
                                                boxSize={6}
                                                bgGradient="linear(135deg, yellow.400, orange.500)"
                                                border="3px solid"
                                                borderColor="white"
                                                boxShadow="0 4px 12px rgba(250, 204, 21, 0.4)"
                                                _hover={{
                                                    transform: "scale(1.1)",
                                                    boxShadow: "0 6px 16px rgba(250, 204, 21, 0.6)"
                                                }}
                                                _active={{
                                                    transform: "scale(1.05)"
                                                }}
                                                transition="all 0.2s ease"
                                            />
                                        </Slider>

                                        {/* Slider Labels */}
                                        <HStack justify="space-between" mt={2} px={2}>
                                            {prizePoolSteps.map((value, index) => (
                                                <Text
                                                    key={index}
                                                    color={index === prizePoolSliderValue ? "yellow.400" : "gray.500"}
                                                    fontSize="xs"
                                                    fontWeight={index === prizePoolSliderValue ? "bold" : "normal"}
                                                    textAlign="center"
                                                    minW="20px"
                                                >
                                                    {value}
                                                </Text>
                                            ))}
                                        </HStack>

                                        {/* Current Value Display with Manual Input */}
                                        <Box
                                            mt={4}
                                            p={4}
                                            bg="gray.700"
                                            borderRadius="xl"
                                            border="2px solid"
                                            borderColor="yellow.400"
                                        >
                                            <VStack spacing={3}>
                                                <Text color="yellow.400" fontSize="lg" fontWeight="bold" textAlign="center">
                                                    {isManualInput ? formData.entryFee : getAmountFromSliderValue(prizePoolSliderValue).toFixed(4)} EGLD
                                                </Text>
                                                <Text color="gray.400" fontSize="sm" textAlign="center">
                                                    Entry Fee
                                                </Text>

                                                {/* Manual Input */}
                                                <Box w="full">
                                                    <Text color="gray.300" fontSize="xs" mb={2} textAlign="center">
                                                        Or enter custom amount:
                                                    </Text>
                                                    <Input
                                                        type="number"
                                                        step="0.01"
                                                        min="0.01"
                                                        max="100"
                                                        value={formData.entryFee}
                                                        onChange={(e) => {
                                                            setIsManualInput(true);
                                                            handleInputChange('entryFee', e.target.value);
                                                        }}
                                                        onBlur={() => {
                                                            // Update slider when user finishes typing
                                                            if (isManualInput) {
                                                                if (formData.entryFee && formData.entryFee.trim() !== '') {
                                                                    const numValue = parseFloat(formData.entryFee);
                                                                    if (numValue >= 0.01 && numValue <= 100) {
                                                                        const sliderPos = getSliderValueFromAmount(numValue);
                                                                        setPrizePoolSliderValue(sliderPos);
                                                                    }
                                                                } else {
                                                                    // If input is empty, reset to default
                                                                    setFormData(prev => ({ ...prev, entryFee: '0.1' }));
                                                                    setPrizePoolSliderValue(getSliderValueFromAmount(0.1));
                                                                }
                                                                setIsManualInput(false);
                                                            }
                                                        }}
                                                        size="md"
                                                        bg="gray.700"
                                                        border="2px solid"
                                                        borderColor="gray.600"
                                                        borderRadius="xl"
                                                        _hover={{
                                                            borderColor: "yellow.400",
                                                            transform: "translateY(-1px)",
                                                            boxShadow: "0 4px 12px rgba(255, 255, 0, 0.2)"
                                                        }}
                                                        _focus={{
                                                            borderColor: "yellow.400",
                                                            boxShadow: "0 0 0 3px rgba(255, 255, 0, 0.1)"
                                                        }}
                                                        _placeholder={{
                                                            color: "gray.400"
                                                        }}
                                                        placeholder="0.22"
                                                    />
                                                </Box>
                                            </VStack>
                                        </Box>
                                    </Box>
                                    {errors.entryFee && (
                                        <Text color="red.400" fontSize="xs" mt={1} fontWeight="medium">
                                            {errors.entryFee}
                                        </Text>
                                    )}
                                </FormControl>


                                {/* Cool Tournament Summary */}
                                <Box
                                    bgGradient="linear(135deg, gray.700, gray.800)"
                                    border="2px solid"
                                    borderColor="gray.600"
                                    borderRadius="xl"
                                    p={4}
                                    boxShadow="0 8px 20px rgba(0,0,0,0.2)"
                                    _hover={{
                                        borderColor: "purple.400",
                                        transform: "translateY(-2px)",
                                        boxShadow: "0 12px 25px rgba(147, 51, 234, 0.2)"
                                    }}
                                    transition="all 0.3s ease"
                                >
                                    <HStack justify="space-between" align="center" wrap="wrap">
                                        <HStack spacing={6}>
                                            <HStack spacing={2}>
                                                <Box
                                                    p={1}
                                                    bgGradient="linear(135deg, green.500, emerald.600)"
                                                    borderRadius="md"
                                                >
                                                    <FontAwesomeIcon icon={faCoins} color="white" size="sm" />
                                                </Box>
                                                <Text color="gray.300" fontSize="sm" fontWeight="semibold">
                                                    Max Prize Pool:
                                                </Text>
                                                <Text
                                                    color="green.400"
                                                    fontSize="lg"
                                                    fontWeight="bold"
                                                >
                                                    {(parseFloat(formData.entryFee) * parseInt(formData.maxPlayers)).toFixed(4)} EGLD
                                                </Text>
                                            </HStack>
                                        </HStack>
                                    </HStack>
                                </Box>

                                {/* Warning Card for Auto-joined as Creator */}
                                <Box
                                    bgGradient="linear(135deg, orange.500, red.500)"
                                    borderRadius="xl"
                                    p={4}
                                    border="2px solid"
                                    borderColor="orange.400"
                                    boxShadow="0 8px 20px rgba(251, 146, 60, 0.3)"
                                    position="relative"
                                    overflow="hidden"
                                    _hover={{
                                        borderColor: "orange.300",
                                        transform: "translateY(-2px)",
                                        boxShadow: "0 12px 25px rgba(251, 146, 60, 0.4)"
                                    }}
                                    transition="all 0.3s ease"
                                >
                                    {/* Animated Background */}
                                    <Box
                                        position="absolute"
                                        top={0}
                                        left={0}
                                        right={0}
                                        h="4px"
                                        bgGradient="linear(90deg, orange.400, red.500, orange.400)"
                                        backgroundSize="200% 100%"
                                        animation="gradient 3s ease infinite"
                                        sx={{
                                            '@keyframes gradient': {
                                                '0%': { backgroundPosition: '0% 50%' },
                                                '50%': { backgroundPosition: '100% 50%' },
                                                '100%': { backgroundPosition: '0% 50%' }
                                            }
                                        }}
                                    />

                                    <HStack spacing={3} align="center">
                                        <Box
                                            p={2}
                                            bg="white"
                                            borderRadius="xl"
                                            boxShadow="0 4px 12px rgba(0,0,0,0.2)"
                                        >
                                            <FontAwesomeIcon icon={faExclamationTriangle} color="#f97316" size="lg" />
                                        </Box>
                                        <VStack spacing={1} align="start" flex="1">
                                            <Text color="white" fontSize="md" fontWeight="bold">
                                                Auto-joined as Creator
                                            </Text>
                                            <Text color="orange.100" fontSize="sm">
                                                You will automatically be added as a participant when you create this tournament. The entry fee will be deducted from your wallet during the creation transaction.
                                            </Text>
                                        </VStack>
                                    </HStack>
                                </Box>

                                <Button
                                    type="submit"
                                    size="lg"
                                    width="full"
                                    isLoading={isSubmitting}
                                    loadingText="Creating Tournament..."
                                    isDisabled={!isConnected}
                                    bgGradient="linear(135deg, blue.500, purple.600, pink.500)"
                                    color="white"
                                    fontWeight="bold"
                                    fontSize="lg"
                                    py={6}
                                    borderRadius="xl"
                                    boxShadow="0 10px 30px rgba(59, 130, 246, 0.4)"
                                    _hover={{
                                        transform: "translateY(-3px)",
                                        boxShadow: "0 15px 40px rgba(59, 130, 246, 0.6)",
                                        bgGradient: "linear(135deg, blue.600, purple.700, pink.600)"
                                    }}
                                    _active={{
                                        transform: "translateY(-1px)",
                                        boxShadow: "0 8px 25px rgba(59, 130, 246, 0.5)"
                                    }}
                                    _disabled={{
                                        bg: "gray.600",
                                        color: "gray.400",
                                        cursor: "not-allowed",
                                        transform: "none",
                                        boxShadow: "none"
                                    }}
                                    transition="all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
                                    position="relative"
                                    overflow="hidden"
                                >
                                    {/* Animated background effect */}
                                    <Box
                                        position="absolute"
                                        top={0}
                                        left="-100%"
                                        w="100%"
                                        h="100%"
                                        bgGradient="linear(90deg, transparent, rgba(255,255,255,0.2), transparent)"
                                        transition="left 0.5s ease"
                                        _groupHover={{
                                            left: "100%"
                                        }}
                                    />
                                    <Text>Create Tournament</Text>
                                </Button>
                            </VStack>
                        </form>
                    </CardBody>
                </Card>
            </VStack >
        </Container >
    );
};

export default CreateTournament; 