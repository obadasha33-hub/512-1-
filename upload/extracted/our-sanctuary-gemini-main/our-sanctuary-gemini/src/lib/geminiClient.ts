import { AppState } from '../types';
import { supabase } from './supabase';

async function callEdgeFunction(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('sanctuary-ai', { body });

  if (error) {
    throw new Error(error.message || `Edge Function returned ${error.status || 500}`);
  }

  return data;
}

interface ChatParams {
  userMessage: string;
  names: { me: string; partner: string };
  aiMemory: AppState['aiMemory'];
  chatHistory?: { role: 'user' | 'ai'; text: string }[];
  apiKey?: string;
}

export async function fetchAiChat(params: ChatParams) {
  return callEdgeFunction({
    action: 'chat',
    userMessage: params.userMessage,
    names: params.names,
    aiMemory: params.aiMemory,
    chatHistory: params.chatHistory,
    apiKey: params.apiKey,
  });
}

export async function fetchAiSuggestions(aiMemory: AppState['aiMemory'], moods: string[], apiKey?: string) {
  return callEdgeFunction({
    action: 'suggestions',
    aiMemory,
    moods,
    apiKey,
  });
}

export async function fetchAiGameCards(mode: 'compromise' | 'taboo' | 'desire', aiMemory: AppState['aiMemory'], apiKey?: string) {
  return callEdgeFunction({
    action: 'game-cards',
    gameMode: mode,
    aiMemory,
    apiKey,
  });
}
