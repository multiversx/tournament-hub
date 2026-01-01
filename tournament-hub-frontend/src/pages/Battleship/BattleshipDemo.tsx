import React from 'react';
import BattleshipGame from './BattleshipGame';

const BattleshipDemo: React.FC = () => {
    // For demo purposes, we'll use a mock session ID
    // In a real implementation, this would come from the URL params or props
    const mockSessionId = 'demo-battleship-session';

    return (
        <div>
            <BattleshipGame />
        </div>
    );
};

export default BattleshipDemo;

