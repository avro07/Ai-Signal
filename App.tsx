import React, { useState, useEffect, useCallback } from 'react';
import { CoinCard } from './components/CoinCard';
import { AddCoinModal } from './components/AddCoinModal';
import { useLocalStorage } from './hooks/useLocalStorage';
import { requestNotificationPermission, showNotification } from './services/notificationService';
import type { Coin } from './types';
import { PlusIcon, BellIcon, DownloadIcon } from './components/Icons';

// Define the event type for the BeforeInstallPromptEvent
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

const App: React.FC = () => {
  const [coins, setCoins] = useLocalStorage<string[]>('trackedCoins', ['BTCUSDT', 'ETHUSDT']);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCoin, setEditingCoin] = useState<string | null>(null);
  const [notificationPermission, setNotificationPermission] = useState(Notification.permission);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  const handleRequestPermission = useCallback(async () => {
    const permission = await requestNotificationPermission();
    setNotificationPermission(permission);
    if (permission === 'granted') {
        showNotification('Permissions Granted!', { body: 'You will now receive price alerts.' });
    }
  }, []);
  
  // PWA Install Prompt Logic
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);
  
  // Register Service Worker
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        // Construct an absolute URL to the service worker to avoid origin issues.
        // Using window.location.origin is more robust than new URL(...) with window.location.href,
        // which can fail in some sandboxed environments.
        const swUrl = `${window.location.origin}/sw.js`;
        navigator.serviceWorker.register(swUrl)
          .then(registration => console.log('Service Worker registered:', registration))
          .catch(err => console.error('Service Worker registration failed:', err));
      });
    }
  }, []);

  const handleInstallClick = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      console.log('User accepted the Add to Home Screen prompt');
    }
    setInstallPrompt(null);
  };

  const handleAddCoin = (symbol: string) => {
    const upperSymbol = symbol.toUpperCase();
    if (!coins.includes(upperSymbol)) {
      setCoins([...coins, upperSymbol]);
    }
    setIsModalOpen(false);
  };

  const handleEditCoin = (newSymbol: string) => {
    if (editingCoin) {
      const upperSymbol = newSymbol.toUpperCase();
      setCoins(coins.map(c => (c === editingCoin ? upperSymbol : c)));
    }
    setEditingCoin(null);
    setIsModalOpen(false);
  };

  const openEditModal = (symbol: string) => {
    setEditingCoin(symbol);
    setIsModalOpen(true);
  };
  
  const openAddModal = () => {
    setEditingCoin(null);
    setIsModalOpen(true);
  };

  const handleDeleteCoin = (symbol: string) => {
    setCoins(coins.filter(c => c !== symbol));
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans">
      {/* Sticky Header Wrapper */}
      <div className="sticky top-0 z-10 backdrop-blur-sm pt-4 pb-2">
        <header className="container mx-auto bg-gray-800/70 p-2 sm:p-4 rounded-xl border border-gray-700 flex justify-between items-center">
            <h1 className="text-2xl font-bold text-cyan-400">
                <i className="fas fa-chart-line"></i>
            </h1>
            <div className="flex items-center space-x-2 sm:space-x-4">
                {notificationPermission !== 'granted' && (
                    <button
                        onClick={handleRequestPermission}
                        className="flex items-center bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-2 px-3 sm:py-2 sm:px-4 rounded-lg transition-colors duration-300"
                    >
                        <BellIcon />
                        <span className="hidden sm:inline ml-2">Enable Alerts</span>
                    </button>
                )}
                {installPrompt && (
                    <button
                        onClick={handleInstallClick}
                        className="flex items-center bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-3 sm:py-2 sm:px-4 rounded-lg transition-colors duration-300"
                        title="অ্যাপ ইনস্টল করুন"
                    >
                        <DownloadIcon />
                        <span className="hidden sm:inline ml-2">অ্যাপ ইনস্টল করুন</span>
                    </button>
                )}
                <button
                onClick={openAddModal}
                className="flex items-center bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-2 px-3 sm:py-2 sm:px-4 rounded-lg transition-colors duration-300"
                >
                <PlusIcon />
                <span className="hidden sm:inline ml-2">Add Coin</span>
                </button>
            </div>
        </header>
      </div>


      <main className="container mx-auto p-4 md:p-6">
        {coins.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {coins.map(symbol => (
              <CoinCard
                key={symbol}
                symbol={symbol}
                onEdit={() => openEditModal(symbol)}
                onDelete={() => handleDeleteCoin(symbol)}
                notificationsEnabled={notificationPermission === 'granted'}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <p className="text-gray-400 text-lg">No coins being tracked.</p>
            <p className="text-gray-500 mt-2">Click "Add Coin" to get started.</p>
          </div>
        )}
      </main>

      <AddCoinModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={editingCoin ? handleEditCoin : handleAddCoin}
        initialValue={editingCoin || ''}
        trackedCoins={coins}
      />
    </div>
  );
};

export default App;