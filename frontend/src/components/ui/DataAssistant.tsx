"use client";

import { useState, useRef, useEffect } from "react";
import { MessageSquare, X, Send, Bot, User, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DataAssistantProps {
  datasetId: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export function DataAssistant({ datasetId }: DataAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "1",
      role: "assistant",
      content: "Hi! I'm your DataLab Assistant. Ask me questions about your dataset, like 'What is the average of Price?' or 'How many records are there?'"
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: ChatMessage = { id: Date.now().toString(), role: "user", content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const { supabase } = await import("@/lib/supabase");
      const { data: authData } = await supabase.auth.getSession();
      const token = authData.session?.access_token;
      
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/datasets/${datasetId}/assistant/query`, {
        method: "POST",
        headers,
        body: JSON.stringify({ query: userMessage.content })
      });

      if (!res.ok) throw new Error("Failed to get response");
      const data = await res.json();

      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: "assistant",
        content: data.response
      }]);
    } catch (error) {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: "assistant",
        content: "Sorry, I encountered an error while analyzing the data."
      }]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-xl flex items-center justify-center transition-transform hover:scale-105 z-50 group"
      >
        <Sparkles className="w-6 h-6 group-hover:animate-pulse" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-80 md:w-96 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col z-50" style={{ height: '500px', maxHeight: '80vh' }}>
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-4 text-white flex justify-between items-center shadow-md">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5" />
          <h3 className="font-bold">Data Assistant</h3>
        </div>
        <button onClick={() => setIsOpen(false)} className="text-white/80 hover:text-white transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Chat Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/30">
        {messages.map(msg => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              </div>
            )}
            <div className={`p-3 rounded-2xl max-w-[80%] text-sm ${
              msg.role === 'user' 
                ? 'bg-indigo-600 text-white rounded-tr-sm' 
                : 'bg-background border border-border shadow-sm rounded-tl-sm'
            }`}>
              {msg.content}
            </div>
            {msg.role === 'user' && (
              <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center shrink-0">
                <User className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="p-3 rounded-2xl bg-background border border-border shadow-sm rounded-tl-sm text-sm flex gap-1 items-center">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 bg-background border-t border-border">
        <form 
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          className="flex gap-2"
        >
          <input
            type="text"
            placeholder="Ask a question..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 bg-muted border border-border rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            disabled={loading}
          />
          <button 
            type="submit"
            disabled={!input.trim() || loading}
            className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center disabled:opacity-50 transition-colors hover:bg-indigo-700"
          >
            <Send className="w-4 h-4 ml-0.5" />
          </button>
        </form>
      </div>
    </div>
  );
}
