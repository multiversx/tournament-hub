#!/bin/bash
# Simple script to run tests with virtual environment

echo "🚀 Running Blockchain Tests with Virtual Environment"
echo "=================================================="

# Activate virtual environment
source venv/bin/activate

# Check if virtual environment is activated
if [[ "$VIRTUAL_ENV" != "" ]]; then
    echo "✅ Virtual environment activated: $VIRTUAL_ENV"
else
    echo "❌ Failed to activate virtual environment"
    exit 1
fi

# Run the tests
echo ""
echo "🧪 Running blockchain submission tests..."
python test_blockchain_submission.py

if [ $? -eq 0 ]; then
    echo ""
    echo "🧪 Running TicTacToe integration tests..."
    python test_tictactoe_integration.py
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "🎉 All tests passed! Ready for devnet deployment."
    else
        echo ""
        echo "❌ TicTacToe integration tests failed."
        exit 1
    fi
else
    echo ""
    echo "❌ Blockchain submission tests failed."
    exit 1
fi
