
import type { GoogleGenAI } from "@google/genai";
import type { GeminiAnalysis } from '../types';
import { Signal } from '../types';


// IMPORTANT: This assumes process.env.API_KEY is set in the environment.
// In a real application, this key should be handled securely and not exposed on the client-side.
// This service should ideally be a backend route that the frontend calls.

let ai: GoogleGenAI | null = null;

// Lazily initialize the AI client using dynamic import to prevent "process is not defined" error
// on module load in browser environments.
const getAiClient = async (): Promise<GoogleGenAI | null> => {
    if (ai) {
        return ai;
    }
    try {
        // The execution environment is expected to provide process.env.API_KEY.
        // This check is a safeguard.
        const apiKey = typeof process !== 'undefined' && process.env ? process.env.API_KEY : undefined;

        if (apiKey) {
            // Dynamically import the module only when the API key is available and the function is called.
            const { GoogleGenAI } = await import('@google/genai');
            ai = new GoogleGenAI({ apiKey: apiKey as string });
            return ai;
        } else {
            console.error("GoogleGenAI could not be initialized. API_KEY is missing from the environment.");
            return null;
        }
    } catch (error) {
        console.error("Failed to initialize GoogleGenAI. Is API_KEY set correctly?", error);
        return null;
    }
};


export const getTradingSignal = async (symbol: string, price: number, high24h: number, low24h: number): Promise<GeminiAnalysis | null> => {
    const localAi = await getAiClient();
    if (!localAi) {
        console.error("Gemini AI not initialized. Cannot fetch trading signal.");
        return Promise.resolve({
            signal: Signal.NONE,
            entry_point: 0,
            exit_point: 0,
            reasoning: 'AI service is not available. Please check the API key configuration.',
            confidence_score: 0
        });
    }
    
    // Dynamically import `Type` enum when needed for the schema.
    const { Type } = await import('@google/genai');

    const prompt = `
        Analyze the cryptocurrency ${symbol} for a short-term trade.
        Current Price: ${price}
        24h High: ${high24h}
        24h Low: ${low24h}

        Based on common technical indicators (assuming 1-hour chart data):
        1.  Provide a trading signal (BUY, SELL, HOLD).
        2.  Suggest an entry point and an exit point (for profit or stop-loss).
        3.  Provide a confidence score (0-1).
        4.  Provide a brief reasoning in the Bengali language.
        5.  Provide the current values and a very concise, user-friendly interpretation for each of the following technical indicators. The interpretation should be in simple terms, suitable for a beginner, and ideally under 10 words.
            - EMA (use a common period like 20 or 50).
            - RSI (14-period).
            - MACD (standard 12, 26, 9 periods).
            - Volume (provide a qualitative interpretation, e.g., "High buying volume").

        Your response must be in JSON format matching the specified schema.
    `;

    try {
        const response = await localAi.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        signal: { type: Type.STRING, enum: ['BUY', 'SELL', 'HOLD'] },
                        entry_point: { type: Type.NUMBER },
                        exit_point: { type: Type.NUMBER },
                        reasoning: { type: Type.STRING },
                        confidence_score: { type: Type.NUMBER },
                        technical_indicators: {
                            type: Type.OBJECT,
                            properties: {
                                ema: {
                                    type: Type.OBJECT,
                                    properties: {
                                        value: { type: Type.NUMBER },
                                        period: { type: Type.INTEGER },
                                        interpretation: { type: Type.STRING },
                                    },
                                    required: ["value", "period", "interpretation"],
                                },
                                rsi: {
                                    type: Type.OBJECT,
                                    properties: {
                                        value: { type: Type.NUMBER },
                                        period: { type: Type.INTEGER },
                                        interpretation: { type: Type.STRING },
                                    },
                                    required: ["value", "period", "interpretation"],
                                },
                                macd: {
                                    type: Type.OBJECT,
                                    properties: {
                                        macd_line: { type: Type.NUMBER },
                                        signal_line: { type: Type.NUMBER },
                                        histogram: { type: Type.NUMBER },
                                        interpretation: { type: Type.STRING },
                                    },
                                    required: ["macd_line", "signal_line", "histogram", "interpretation"],
                                },
                                volume: {
                                    type: Type.OBJECT,
                                    properties: {
                                        interpretation: { type: Type.STRING },
                                    },
                                    required: ["interpretation"],
                                }
                            },
                        }
                    },
                    required: ["signal", "reasoning", "confidence_score", "technical_indicators"],
                },
            },
        });
        
        const jsonText = response.text.trim();
        const analysis = JSON.parse(jsonText);
        
        // Validate the signal enum value
        const signalValue = analysis.signal.toUpperCase() as Signal;
        if (!Object.values(Signal).includes(signalValue)) {
            throw new Error(`Invalid signal value received: ${analysis.signal}`);
        }
        
        return {
            ...analysis,
            signal: signalValue,
        };

    } catch (error) {
        console.error('Error getting trading signal from Gemini:', error);
        return {
            signal: Signal.NONE,
            entry_point: 0,
            exit_point: 0,
            reasoning: 'Failed to retrieve analysis from AI. The model may have returned an unexpected format or an error occurred.',
            confidence_score: 0,
            technical_indicators: undefined
        };
    }
};