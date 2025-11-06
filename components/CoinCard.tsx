import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Coin, GeminiAnalysis, BinanceTickerPayload, PriceAlerts, TechnicalIndicators } from '../types';
import { Signal } from '../types';
import { showNotification } from '../services/notificationService';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { EditIcon, TrashIcon, SparkIcon, BuyIcon, SellIcon, HoldIcon, ChevronDownIcon, BellIcon, ChartBarIcon, RefreshIcon } from './Icons';

interface CoinCardProps {
  symbol: string;
  onEdit: () => void;
  onDelete: () => void;
  notificationsEnabled: boolean;
}

const PriceDisplay: React.FC<{ price: number; change: number }> = ({ price, change }) => {
    const color = change > 0 ? 'text-green-400' : change < 0 ? 'text-red-400' : 'text-gray-400';
    const icon = change > 0 ? '▲' : change < 0 ? '▼' : '';
    return (
        <div className={`text-3xl font-bold ${color} transition-colors duration-500`}>
            {icon} {price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
        </div>
    );
};

// Custom hook to get the previous value of a prop or state.
function usePrevious<T>(value: T): T | undefined {
  // FIX: Provide an initial value to useRef as it is required when a generic is used.
  const ref = useRef<T | undefined>(undefined);
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
}

const ToggleSwitch: React.FC<{ id?: string; checked: boolean; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; disabled?: boolean; }> = ({ id, checked, onChange, disabled = false }) => {
    return (
      <label className={`relative inline-flex items-center ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
        <input id={id} type="checkbox" checked={checked} onChange={onChange} className="sr-only peer" disabled={disabled} />
        <div className="w-9 h-5 bg-gray-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-600"></div>
      </label>
    );
  };

export const CoinCard: React.FC<CoinCardProps> = ({ symbol, onEdit, onDelete, notificationsEnabled }) => {
    const [coinData, setCoinData] = useState<Coin | null>(null);
    const previousCoinData = usePrevious(coinData);
    const [analysis, setAnalysis] = useState<GeminiAnalysis | null>(null);
    const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
    const [isAnalysisVisible, setIsAnalysisVisible] = useState(false);
    const [expandedIndicators, setExpandedIndicators] = useState<Record<string, boolean>>({});

    const [alerts, setAlerts] = useLocalStorage<PriceAlerts>('priceAlerts', {});
    const [highAlertInput, setHighAlertInput] = useState<string>('');
    const [lowAlertInput, setLowAlertInput] = useState<string>('');
    const [triggeredAlertType, setTriggeredAlertType] = useState<'high' | 'low' | null>(null);

    useEffect(() => {
        setHighAlertInput(alerts[symbol]?.high?.toString() || '');
        setLowAlertInput(alerts[symbol]?.low?.toString() || '');
    }, [alerts, symbol]);
    
    const handleSetAlert = (type: 'high' | 'low') => {
        const value = type === 'high' ? highAlertInput : lowAlertInput;
        const numericValue = parseFloat(value);

        setAlerts(prevAlerts => {
            const newAlerts = JSON.parse(JSON.stringify(prevAlerts));
            if (!newAlerts[symbol]) newAlerts[symbol] = {};
            if (!isNaN(numericValue) && numericValue > 0) {
                newAlerts[symbol][type] = numericValue;
            } else {
                delete newAlerts[symbol][type];
            }
            if (Object.keys(newAlerts[symbol]).length === 0) delete newAlerts[symbol];
            return newAlerts;
        });
    };

    const handleQuickSetAlert = (type: 'high' | 'low', value: number) => {
        if (type === 'high') {
            setHighAlertInput(value.toString());
        } else {
            setLowAlertInput(value.toString());
        }
        setAlerts(prevAlerts => {
            const newAlerts = JSON.parse(JSON.stringify(prevAlerts));
            if (!newAlerts[symbol]) newAlerts[symbol] = {};
            newAlerts[symbol][type] = value;
            return newAlerts;
        });
    };
    
    const handleToggleBreakoutAlert = (type: 'notifyOnNewHigh' | 'notifyOnNewLow') => (e: React.ChangeEvent<HTMLInputElement>) => {
        const isChecked = e.target.checked;
        const persistenceType = type === 'notifyOnNewHigh' ? 'persistHigh' : 'persistLow';
        setAlerts(prevAlerts => {
            const newAlerts = JSON.parse(JSON.stringify(prevAlerts));
            if (!newAlerts[symbol]) newAlerts[symbol] = {};
            if (isChecked) {
                newAlerts[symbol][type] = true;
            } else {
                delete newAlerts[symbol][type];
                delete newAlerts[symbol][persistenceType]; // Also clear persistence on disable
            }
            if (Object.keys(newAlerts[symbol]).length === 0) delete newAlerts[symbol];
            return newAlerts;
        });
    };

    const handleTogglePersistence = (type: 'persistHigh' | 'persistLow') => (e: React.ChangeEvent<HTMLInputElement>) => {
        const isChecked = e.target.checked;
        setAlerts(prevAlerts => {
            const newAlerts = JSON.parse(JSON.stringify(prevAlerts));
            if (!newAlerts[symbol]) newAlerts[symbol] = {};
            if (isChecked) {
                newAlerts[symbol][type] = true;
            } else {
                delete newAlerts[symbol][type];
            }
            return newAlerts;
        });
    };

    // WebSocket connection effect
    useEffect(() => {
        const ws = new WebSocket(`wss://fstream.binance.com/ws/${symbol.toLowerCase()}@ticker`);

        ws.onmessage = (event) => {
            try {
                const data: BinanceTickerPayload = JSON.parse(event.data);
                const newCoinData: Coin = {
                    symbol: data.s,
                    price: parseFloat(data.c),
                    high24h: parseFloat(data.h),
                    low24h: parseFloat(data.l),
                    priceChangePercent: parseFloat(data.P),
                };
                setCoinData(newCoinData);
            } catch (error) {
                console.error(`Error parsing WebSocket data for ${symbol}:`, error);
            }
        };

        ws.onerror = (error) => console.error(`WebSocket error for ${symbol}:`, error);

        return () => {
            if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) ws.close();
        };
    }, [symbol]);

    // Notification effect
    useEffect(() => {
        if (!previousCoinData || !coinData || !notificationsEnabled) return;

        const lastPrice = previousCoinData.price;
        const currentPrice = coinData.price;
        const coinAlerts = alerts[symbol];

        // Check for custom high alert
        if (coinAlerts?.high && currentPrice >= coinAlerts.high && lastPrice < coinAlerts.high) {
            showNotification(`${symbol} Target Reached`, { body: `Price hit your target of $${coinAlerts.high.toLocaleString()}` }, true);
            setTriggeredAlertType('high');
            setTimeout(() => setTriggeredAlertType(null), 3000);
            setAlerts(prev => {
                const newAlerts = JSON.parse(JSON.stringify(prev));
                if (newAlerts[symbol]) delete newAlerts[symbol].high;
                return newAlerts;
            });
        }

        // Check for custom low alert
        if (coinAlerts?.low && currentPrice <= coinAlerts.low && lastPrice > coinAlerts.low) {
            showNotification(`${symbol} Stop Price Reached`, { body: `Price fell to your stop of $${coinAlerts.low.toLocaleString()}` }, true);
            setTriggeredAlertType('low');
            setTimeout(() => setTriggeredAlertType(null), 3000);
            setAlerts(prev => {
                const newAlerts = JSON.parse(JSON.stringify(prev));
                if (newAlerts[symbol]) delete newAlerts[symbol].low;
                return newAlerts;
            });
        }

        // Check for 24h high breakout
        if (coinAlerts?.notifyOnNewHigh && currentPrice > previousCoinData.high24h) {
            showNotification(`${symbol} New 24h High`, { body: `Price broke the previous 24h high of $${previousCoinData.high24h.toLocaleString()}` }, true);
            if (!coinAlerts.persistHigh) {
                setAlerts(prev => {
                    const newAlerts = JSON.parse(JSON.stringify(prev));
                    if (newAlerts[symbol]) delete newAlerts[symbol].notifyOnNewHigh;
                    return newAlerts;
                });
            }
        }

        // Check for 24h low breakout
        if (coinAlerts?.notifyOnNewLow && currentPrice < previousCoinData.low24h) {
            showNotification(`${symbol} New 24h Low`, { body: `Price broke the previous 24h low of $${previousCoinData.low24h.toLocaleString()}` }, true);
            if (!coinAlerts.persistLow) {
                setAlerts(prev => {
                    const newAlerts = JSON.parse(JSON.stringify(prev));
                    if (newAlerts[symbol]) delete newAlerts[symbol].notifyOnNewLow;
                    return newAlerts;
                });
            }
        }

    }, [coinData, previousCoinData, alerts, notificationsEnabled, setAlerts, symbol]);


    const handleGetAnalysis = async () => {
        if (!coinData) return;
        setIsLoadingAnalysis(true);
        setAnalysis(null);
        setIsAnalysisVisible(false);
        setExpandedIndicators({});
        try {
            const { getTradingSignal } = await import('../services/geminiService');
            const result = await getTradingSignal(symbol, coinData.price, coinData.high24h, coinData.low24h);
            if (result) {
                setAnalysis(result);
                setIsAnalysisVisible(true);
                if(notificationsEnabled && (result.signal === Signal.BUY || result.signal === Signal.SELL)) {
                     showNotification(`${symbol} سیگন্যাল: ${result.signal}`, { body: result.reasoning }, true);
                }
            }
        } catch (error) {
            console.error('Error fetching AI analysis:', error);
            setAnalysis({
                signal: Signal.NONE,
                entry_point: 0,
                exit_point: 0,
                reasoning: 'AI analysis could not be loaded. Please try again later.',
                confidence_score: 0,
            });
            setIsAnalysisVisible(true);
        } finally {
            setIsLoadingAnalysis(false);
        }
    };
    
    const toggleIndicator = (name: string) => {
        setExpandedIndicators(prev => ({ ...prev, [name]: !prev[name] }));
    };

    const getSignalStyling = (signal: Signal) => {
        switch (signal) {
            case Signal.BUY: return { bgColor: 'bg-green-500/20', textColor: 'text-green-300', icon: <BuyIcon className="h-5 w-5 text-green-400" /> };
            case Signal.SELL: return { bgColor: 'bg-red-500/20', textColor: 'text-red-300', icon: <SellIcon className="h-5 w-5 text-red-400" /> };
            case Signal.HOLD: return { bgColor: 'bg-yellow-500/20', textColor: 'text-yellow-300', icon: <HoldIcon className="h-5 w-5 text-yellow-400" /> };
            default: return { bgColor: 'bg-gray-700/20', textColor: 'text-gray-300', icon: null };
        }
    };

    const renderIndicators = (indicators: TechnicalIndicators) => {
        const rsi = indicators.rsi.value;
        const rsiColor = rsi > 70 ? 'text-red-400' : rsi < 30 ? 'text-green-400' : 'text-gray-300';
        const rsiLabel = rsi > 70 ? 'Overbought' : rsi < 30 ? 'Oversold' : 'Neutral';

        const macdHistogram = indicators.macd.histogram;
        const macdColor = macdHistogram > 0 ? 'text-green-400' : 'text-red-400';
        
        const IndicatorAccordion: React.FC<{ name: string, title: React.ReactNode, children: React.ReactNode }> = ({ name, title, children }) => (
            <div className="bg-gray-900/50 rounded-md overflow-hidden">
                <button
                    onClick={() => toggleIndicator(name)}
                    className="w-full p-2 text-left flex justify-between items-center hover:bg-gray-800/50 transition-colors"
                    aria-expanded={!!expandedIndicators[name]}
                    aria-controls={`${name}-details`}
                >
                    <div>{title}</div>
                    <ChevronDownIcon className={`h-5 w-5 text-gray-400 transition-transform duration-300 ${expandedIndicators[name] ? 'rotate-180' : ''}`} />
                </button>
                {expandedIndicators[name] && (
                    <div id={`${name}-details`} className="p-3 border-t border-gray-700/50">
                        {children}
                    </div>
                )}
            </div>
        );

        return (
            <div className="space-y-2 text-sm">
                <IndicatorAccordion name="ema" title={
                    <>
                        <span className="text-gray-400 font-semibold">EMA ({indicators.ema.period})</span>
                        <span className="ml-2 font-mono text-white">${indicators.ema.value.toLocaleString()}</span>
                    </>
                }>
                    <p className="text-xs text-gray-500 italic">{indicators.ema.interpretation}</p>
                </IndicatorAccordion>
                
                <IndicatorAccordion name="rsi" title={
                    <>
                        <span className="text-gray-400 font-semibold">RSI ({indicators.rsi.period})</span>
                        <span className={`ml-2 font-mono font-bold ${rsiColor}`}>{rsi.toFixed(2)} ({rsiLabel})</span>
                    </>
                }>
                    <p className="text-xs text-gray-500 italic">{indicators.rsi.interpretation}</p>
                </IndicatorAccordion>
                
                <IndicatorAccordion name="macd" title={
                    <>
                        <span className="text-gray-400 font-semibold">MACD (12,26,9)</span>
                        <span className={`ml-2 font-mono font-bold ${macdColor}`}>Hist: {macdHistogram.toFixed(4)}</span>
                    </>
                }>
                    <div className="space-y-1 font-mono text-white text-xs">
                        <div><span className="text-gray-500 w-16 inline-block">MACD:</span> {indicators.macd.macd_line.toFixed(4)}</div>
                        <div><span className="text-gray-500 w-16 inline-block">Signal:</span> {indicators.macd.signal_line.toFixed(4)}</div>
                    </div>
                    <p className="text-xs text-gray-500 italic mt-2 pt-2 border-t border-gray-700/50">{indicators.macd.interpretation}</p>
                </IndicatorAccordion>
                
                <IndicatorAccordion name="volume" title={
                     <span className="text-gray-400 font-semibold">Volume</span>
                }>
                     <p className="text-xs text-gray-300 italic">{indicators.volume.interpretation}</p>
                </IndicatorAccordion>
            </div>
        );
    };

    const analysisStyling = getSignalStyling(analysis?.signal || Signal.NONE);
    const highAlertClass = triggeredAlertType === 'high' ? 'ring-2 ring-green-500 shadow-lg shadow-green-500/20' : 'border-gray-600';
    const lowAlertClass = triggeredAlertType === 'low' ? 'ring-2 ring-red-500 shadow-lg shadow-red-500/20' : 'border-gray-600';


    if (!coinData) {
        return (
            <div className="bg-gray-800/50 backdrop-blur-md rounded-lg shadow-lg p-4 flex flex-col justify-center items-center h-72 border border-gray-700">
                <div className="animate-pulse text-gray-500">Connecting to {symbol}...</div>
            </div>
        );
    }

    return (
        <div className="bg-gray-800/50 backdrop-blur-md rounded-lg shadow-lg p-4 flex flex-col space-y-4 border border-gray-700 transition-all duration-300 hover:shadow-cyan-500/10 hover:border-cyan-800/50">
            {/* Header */}
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-cyan-400">{symbol}</h2>
                <div className="flex space-x-2">
                    <button 
                        onClick={handleGetAnalysis} 
                        disabled={isLoadingAnalysis}
                        className="text-gray-400 hover:text-white transition-colors p-1.5 rounded-full hover:bg-gray-700 disabled:opacity-50 disabled:cursor-wait"
                        title="Get/Refresh AI analysis"
                    >
                        <RefreshIcon className={`h-4 w-4 ${isLoadingAnalysis ? 'animate-spin' : ''}`} />
                    </button>
                    <button onClick={onEdit} className="text-gray-400 hover:text-white transition-colors p-1.5 rounded-full hover:bg-gray-700"><EditIcon /></button>
                    <button onClick={onDelete} className="text-gray-400 hover:text-red-400 transition-colors p-1.5 rounded-full hover:bg-gray-700"><TrashIcon /></button>
                </div>
            </div>

            {/* Price Info */}
            <div>
                <PriceDisplay price={coinData.price} change={coinData.priceChangePercent} />
                <div className="text-sm text-gray-400">
                    24h Change: <span className={coinData.priceChangePercent >= 0 ? 'text-green-500' : 'text-red-500'}>{coinData.priceChangePercent.toFixed(2)}%</span>
                </div>
            </div>

            {/* 24h High/Low */}
            <div className="flex justify-between text-sm">
                <div className="flex flex-col"><span className="text-gray-500">24h High</span><span onClick={() => handleQuickSetAlert('high', coinData.high24h)} title="Click to set as target price alert" className="font-semibold text-gray-300 cursor-pointer hover:text-cyan-400">{coinData.high24h.toLocaleString()}</span></div>
                <div className="flex flex-col text-right"><span className="text-gray-500">24h Low</span><span onClick={() => handleQuickSetAlert('low', coinData.low24h)} title="Click to set as stop price alert" className="font-semibold text-gray-300 cursor-pointer hover:text-cyan-400">{coinData.low24h.toLocaleString()}</span></div>
            </div>

            {/* Custom Alerts */}
            <div className="space-y-3 pt-2 border-t border-gray-700/50">
                <h3 className="text-xs font-semibold text-gray-400 flex items-center"><BellIcon /><span className="ml-1.5">Custom Alerts</span></h3>
                <div className="grid grid-cols-2 gap-2">
                     <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-green-400 text-xs">▲</span>
                        <input type="number" placeholder="Target Price"
                               className={`w-full bg-gray-900/50 text-white text-sm rounded-md pl-6 pr-2 py-1.5 border focus:ring-2 focus:ring-cyan-500 focus:outline-none transition-all duration-300 ${highAlertClass}`}
                               value={highAlertInput}
                               onChange={e => setHighAlertInput(e.target.value)}
                               onBlur={() => handleSetAlert('high')}
                        />
                     </div>
                     <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-red-400 text-xs">▼</span>
                        <input type="number" placeholder="Stop Price"
                               className={`w-full bg-gray-900/50 text-white text-sm rounded-md pl-6 pr-2 py-1.5 border focus:ring-2 focus:ring-cyan-500 focus:outline-none transition-all duration-300 ${lowAlertClass}`}
                               value={lowAlertInput}
                               onChange={e => setLowAlertInput(e.target.value)}
                               onBlur={() => handleSetAlert('low')}
                        />
                     </div>
                </div>
                <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between p-1 rounded-md">
                        <label htmlFor={`${symbol}-high-alert-toggle`} className="text-gray-400 cursor-pointer">Alert on 24h High</label>
                        <ToggleSwitch
                            id={`${symbol}-high-alert-toggle`}
                            checked={!!alerts[symbol]?.notifyOnNewHigh}
                            onChange={handleToggleBreakoutAlert('notifyOnNewHigh')}
                        />
                    </div>
                    {alerts[symbol]?.notifyOnNewHigh && (
                        <div className="flex items-center justify-between p-2 pl-6 rounded-md bg-gray-900/30" role="group">
                            <label htmlFor={`${symbol}-high-persist-toggle`} className="text-gray-500 text-xs italic cursor-pointer">Keep alert active</label>
                            <ToggleSwitch
                                id={`${symbol}-high-persist-toggle`}
                                checked={!!alerts[symbol]?.persistHigh}
                                onChange={handleTogglePersistence('persistHigh')}
                            />
                        </div>
                    )}
                    <div className="flex items-center justify-between p-1 rounded-md">
                         <label htmlFor={`${symbol}-low-alert-toggle`} className="text-gray-400 cursor-pointer">Alert on 24h Low</label>
                        <ToggleSwitch
                             id={`${symbol}-low-alert-toggle`}
                            checked={!!alerts[symbol]?.notifyOnNewLow}
                            onChange={handleToggleBreakoutAlert('notifyOnNewLow')}
                        />
                    </div>
                     {alerts[symbol]?.notifyOnNewLow && (
                        <div className="flex items-center justify-between p-2 pl-6 rounded-md bg-gray-900/30" role="group">
                            <label htmlFor={`${symbol}-low-persist-toggle`} className="text-gray-500 text-xs italic cursor-pointer">Keep alert active</label>
                            <ToggleSwitch
                                id={`${symbol}-low-persist-toggle`}
                                checked={!!alerts[symbol]?.persistLow}
                                onChange={handleTogglePersistence('persistLow')}
                            />
                        </div>
                    )}
                </div>
            </div>
            
             {/* AI Analysis Section */}
             <div className="pt-2 border-t border-gray-700/50">
                 {isLoadingAnalysis && ( <div className="text-center py-2 text-cyan-400 animate-pulse">Analyzing...</div> )}
                 {analysis && (
                     <div className="space-y-2">
                         <div className={`rounded-lg overflow-hidden transition-all duration-300 ${analysisStyling.bgColor}`}>
                             <button onClick={() => setIsAnalysisVisible(!isAnalysisVisible)} className="w-full p-3 flex justify-between items-center font-bold text-left">
                               <div className="flex items-center space-x-2">
                                 {analysisStyling.icon}
                                 <span className={`${analysisStyling.textColor}`}>{analysis.signal} সিগন্যাল</span>
                               </div>
                               <ChevronDownIcon className={`h-5 w-5 text-gray-400 transition-transform duration-300 ${isAnalysisVisible ? 'rotate-180' : ''}`} />
                             </button>
                             {isAnalysisVisible && (
                                <div className="p-3 border-t border-white/10 text-sm">
                                    <p className="text-gray-300 mb-3">{analysis.reasoning}</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        {analysis.entry_point > 0 && <div><span className="text-gray-400 block">এন্ট্রি</span><span className="font-mono text-white">${analysis.entry_point.toLocaleString()}</span></div>}
                                        {analysis.exit_point > 0 && <div><span className="text-gray-400 block">এক্সিট</span><span className="font-mono text-white">${analysis.exit_point.toLocaleString()}</span></div>}
                                    </div>
                                     <div className="mt-3">
                                        <span className="text-gray-400 block">কনফিডেন্স</span>
                                        <div className="w-full bg-gray-700 rounded-full h-2.5 mt-1"><div className="bg-cyan-400 h-2.5 rounded-full" style={{ width: `${analysis.confidence_score * 100}%` }}></div></div>
                                     </div>
                                </div>
                             )}
                         </div>

                         {analysis.technical_indicators && (
                            <div className="rounded-lg bg-gray-700/20 p-3">
                                <h3 className="text-sm font-bold text-gray-300 flex items-center mb-2">
                                    <ChartBarIcon className="h-5 w-5 text-gray-400" />
                                    <span className="ml-2">Technical Indicators</span>
                                </h3>
                                {renderIndicators(analysis.technical_indicators)}
                            </div>
                        )}
                     </div>
                 )}
             </div>
        </div>
    );
};