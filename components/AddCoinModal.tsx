
import React, { useState, useEffect } from 'react';
import { TOP_50_COINS } from '../constants/coins';

interface AddCoinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (symbol: string) => void;
  initialValue?: string;
  trackedCoins?: string[];
}

export const AddCoinModal: React.FC<AddCoinModalProps> = ({ isOpen, onClose, onSave, initialValue, trackedCoins = [] }) => {
  const [symbol, setSymbol] = useState(initialValue || '');
  const isEditing = !!initialValue;

  useEffect(() => {
    setSymbol(initialValue || '');
  }, [initialValue, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (symbol.trim()) {
      onSave(symbol.trim());
    }
  };

  const handleCoinClick = (coinSymbol: string) => {
    setSymbol(coinSymbol);
  };
  
  const filteredCoins = isEditing ? [] : TOP_50_COINS.filter(
    coin => 
      !trackedCoins.includes(coin) &&
      coin.toLowerCase().includes(symbol.toLowerCase()) &&
      coin.toLowerCase() !== symbol.toLowerCase()
  ).slice(0, 10);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 transition-opacity duration-300" onClick={onClose}>
      <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md mx-4 transform transition-all duration-300" onClick={e => e.stopPropagation()}>
        <h2 className="text-2xl font-bold mb-4 text-cyan-400">{isEditing ? 'Edit Coin' : 'Add New Coin'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="symbol" className="block text-gray-400 text-sm font-bold mb-2">
              Coin Symbol (e.g., BTCUSDT)
            </label>
            <input
              id="symbol"
              type="text"
              value={symbol}
              onChange={e => setSymbol(e.target.value.toUpperCase())}
              placeholder="Search or enter symbol..."
              className="shadow appearance-none border border-gray-600 rounded w-full py-2 px-3 bg-gray-700 text-white leading-tight focus:outline-none focus:ring-2 focus:ring-cyan-500"
              autoFocus
              autoComplete="off"
            />
          </div>

          {!isEditing && filteredCoins.length > 0 && (
            <div className="mb-4 max-h-60 overflow-y-auto bg-gray-900 rounded-md border border-gray-700">
              <p className="text-xs text-gray-500 p-2 font-semibold">Suggestions</p>
              <ul className="divide-y divide-gray-700">
                {filteredCoins.map(coin => (
                  <li key={coin}>
                    <button
                      type="button"
                      onClick={() => handleCoinClick(coin)}
                      className="w-full text-left p-3 hover:bg-gray-700 transition-colors duration-200 text-white"
                    >
                      {coin}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}


          <div className="flex items-center justify-end space-x-4">
            <button
              type="button"
              onClick={onClose}
              className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-2 px-4 rounded transition-colors disabled:opacity-50"
              disabled={!symbol.trim()}
            >
              {isEditing ? 'Save Changes' : 'Add Coin'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
