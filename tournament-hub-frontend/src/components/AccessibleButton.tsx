import React from 'react';
import { Button, ButtonProps } from '@chakra-ui/react';

interface AccessibleButtonProps extends ButtonProps {
    'aria-label'?: string;
    'aria-describedby'?: string;
    'aria-pressed'?: boolean;
    'aria-expanded'?: boolean;
    'aria-haspopup'?: boolean;
    'aria-controls'?: string;
}

export const AccessibleButton: React.FC<AccessibleButtonProps> = ({
    children,
    'aria-label': ariaLabel,
    'aria-describedby': ariaDescribedBy,
    'aria-pressed': ariaPressed,
    'aria-expanded': ariaExpanded,
    'aria-haspopup': ariaHasPopup,
    'aria-controls': ariaControls,
    ...props
}) => {
    return (
        <Button
            aria-label={ariaLabel}
            aria-describedby={ariaDescribedBy}
            aria-pressed={ariaPressed}
            aria-expanded={ariaExpanded}
            aria-haspopup={ariaHasPopup}
            aria-controls={ariaControls}
            _focus={{
                boxShadow: '0 0 0 3px rgba(66, 153, 225, 0.6)',
                outline: 'none',
            }}
            _focusVisible={{
                boxShadow: '0 0 0 3px rgba(66, 153, 225, 0.6)',
                outline: 'none',
            }}
            {...props}
        >
            {children}
        </Button>
    );
};
