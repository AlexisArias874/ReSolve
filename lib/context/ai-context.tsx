"use client";

import { createContext, useContext, useState, ReactNode, useCallback } from "react";

// 1. Exportación de la interfaz del mensaje (Letra 'I' mayúscula)
export interface AIMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  injectableEquation?: string | null;
}

export interface AIActiveContext {
  module: string;
  subtopic: string;
  expression: string;
  result: string;
  details?: string;
}

// 2. Definición del tipo que incluye 'messages', 'setMessages' y 'clearChat'
export interface AIContextType {
  activeContext: AIActiveContext;
  setAIContext: (data: Partial<AIActiveContext>) => void;
  // Inyección inversa
  injectedExpression: string | null;
  injectToCalculator: (expr: string) => void;
  clearInjectedExpression: () => void;
  // Persistencia del chat
  messages: AIMessage[];
  setMessages: React.Dispatch<React.SetStateAction<AIMessage[]>>;
  clearChat: () => void;
}

const defaultContext: AIActiveContext = {
  module: "Matemáticas I",
  subtopic: "Aritmética",
  expression: "",
  result: "",
  details: "",
};

const INITIAL_MESSAGES: AIMessage[] = [
  {
    id: "welcome",
    role: "assistant",
    text: "👋 Hola. Puedes pegarme problemas complejos, ejercicios de examen o enunciados. Deduciré el procedimiento y podrás cargar la ecuación en tu calculadora con un solo clic.",
  },
];

const AIContext = createContext<AIContextType>({
  activeContext: defaultContext,
  setAIContext: () => {},
  injectedExpression: null,
  injectToCalculator: () => {},
  clearInjectedExpression: () => {},
  messages: INITIAL_MESSAGES,
  setMessages: () => {},
  clearChat: () => {},
});

export function AIContextProvider({ children }: { children: ReactNode }) {
  const [activeContext, setActiveState] = useState<AIActiveContext>(defaultContext);
  const [injectedExpression, setInjectedExpression] = useState<string | null>(null);
  const [messages, setMessages] = useState<AIMessage[]>(INITIAL_MESSAGES);

  const setAIContext = useCallback((data: Partial<AIActiveContext>) => {
    setActiveState((prev) => ({ ...prev, ...data }));
  }, []);

  const injectToCalculator = useCallback((expr: string) => {
    setInjectedExpression(expr);
  }, []);

  const clearInjectedExpression = useCallback(() => {
    setInjectedExpression(null);
  }, []);

  const clearChat = useCallback(() => {
    setMessages(INITIAL_MESSAGES);
  }, []);

  return (
    <AIContext.Provider
      value={{
        activeContext,
        setAIContext,
        injectedExpression,
        injectToCalculator,
        clearInjectedExpression,
        messages,
        setMessages,
        clearChat,
      }}
    >
      {children}
    </AIContext.Provider>
  );
}

export function useAIContext() {
  return useContext(AIContext);
}