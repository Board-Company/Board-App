import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  TextInput,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Dimensions,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import Voice, { SpeechResultsEvent, SpeechErrorEvent } from '@react-native-voice/voice';
import { Chess } from 'chess.js';
import ChessBoard from '../components/game/ChessBoard';

// LLM Service configuration
const LLM_SERVICE_URL = 'http://localhost:8001'; // Update with your actual LLM service URL

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  moveExecuted?: string; // Track if this message resulted in a move
};

type ParsedMove = {
  move_san?: string;
  move_uci?: string;
  from_square?: string;
  to_square?: string;
  piece?: string;
  is_castling?: boolean;
  castling_side?: string;
  promotion?: string;
};

const ChessAIScreen = () => {
  const navigation = useNavigation();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hello! I'm your Chess AI assistant. You can speak or type moves like 'knight to f3' or 'castle kingside' and I'll move the pieces for you! Ask me questions or make your move.",
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [fenInput, setFenInput] = useState('');
  const [showFenInput, setShowFenInput] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  
  // Chess game state
  const chessRef = useRef(new Chess());
  const [fen, setFen] = useState(chessRef.current.fen());
  const [playerColor] = useState<'w' | 'b'>('w');
  const [lastMove, setLastMove] = useState<{from: string; to: string} | null>(null);
  const [showBoard, setShowBoard] = useState(true);
  
  const screenWidth = Dimensions.get('window').width;
  const boardSize = Math.min(screenWidth - 32, 300);
  
  // Voice recognition state
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(true);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Initialize voice recognition
  useEffect(() => {
    Voice.onSpeechStart = () => {
      setIsListening(true);
    };

    Voice.onSpeechEnd = () => {
      setIsListening(false);
    };

    Voice.onSpeechResults = (event: SpeechResultsEvent) => {
      if (event.value && event.value.length > 0) {
        const spokenText = event.value[0];
        setInputText(prev => prev ? `${prev} ${spokenText}` : spokenText);
      }
    };

    Voice.onSpeechError = (event: SpeechErrorEvent) => {
      console.error('Speech error:', event.error);
      setIsListening(false);
      if (event.error?.code === 'recognition_fail') {
        setVoiceSupported(false);
      }
    };

    // Check if voice is available
    Voice.isAvailable().then(available => {
      setVoiceSupported(!!available);
    }).catch(() => {
      setVoiceSupported(false);
    });

    return () => {
      Voice.destroy().then(Voice.removeAllListeners);
    };
  }, []);

  // Pulse animation for recording indicator
  useEffect(() => {
    if (isListening) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isListening, pulseAnim]);

  const startListening = async () => {
    try {
      await Voice.start('en-US');
    } catch (error) {
      console.error('Error starting voice:', error);
    }
  };

  const stopListening = async () => {
    try {
      await Voice.stop();
      setIsListening(false);
    } catch (error) {
      console.error('Error stopping voice:', error);
    }
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const generateMessageId = () => {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
  };

  // Check if the input looks like a move command
  const isMoveCommand = (text: string): boolean => {
    const movePatterns = [
      /move\s+\w+/i,
      /\w+\s+to\s+[a-h][1-8]/i,
      /castle/i,
      /^[a-h][1-8]$/i,
      /^[KQRBN][a-h]?[1-8]?x?[a-h][1-8]/i,
      /knight|bishop|rook|queen|king|pawn/i,
      /takes|capture/i,
    ];
    return movePatterns.some(pattern => pattern.test(text.trim()));
  };

  // Execute a move on the chess board
  const executeMove = (parsedMove: ParsedMove): boolean => {
    try {
      let move = null;
      
      // Try castling first
      if (parsedMove.is_castling) {
        const castleMove = parsedMove.castling_side === 'kingside' ? 'O-O' : 'O-O-O';
        move = chessRef.current.move(castleMove);
      }
      // Try SAN notation
      else if (parsedMove.move_san) {
        move = chessRef.current.move(parsedMove.move_san);
      }
      // Try UCI notation
      else if (parsedMove.move_uci || (parsedMove.from_square && parsedMove.to_square)) {
        const from = parsedMove.from_square || parsedMove.move_uci?.substring(0, 2);
        const to = parsedMove.to_square || parsedMove.move_uci?.substring(2, 4);
        if (from && to) {
          move = chessRef.current.move({ from, to, promotion: parsedMove.promotion?.[0]?.toLowerCase() });
        }
      }
      
      if (move) {
        setFen(chessRef.current.fen());
        setLastMove({ from: move.from, to: move.to });
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error executing move:', error);
      return false;
    }
  };

  // Parse move command using LLM service
  const parseMoveCommand = async (command: string): Promise<{success: boolean; parsedMove?: ParsedMove; explanation: string}> => {
    try {
      const response = await fetch(`${LLM_SERVICE_URL}/parse-move`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          command: command,
          current_fen: chessRef.current.fen(),
          player_color: chessRef.current.turn() === 'w' ? 'white' : 'black',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to parse move');
      }

      const data = await response.json();
      return {
        success: data.success,
        parsedMove: data.parsed_move,
        explanation: data.explanation,
      };
    } catch (error) {
      console.error('Error parsing move:', error);
      return {
        success: false,
        explanation: 'Could not connect to AI service to parse move.',
      };
    }
  };

  const sendChatMessage = async (userMessage: string) => {
    if (!userMessage.trim()) return;

    const userMsg: Message = {
      id: generateMessageId(),
      role: 'user',
      content: userMessage,
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);

    try {
      // Check if this looks like a move command
      if (isMoveCommand(userMessage)) {
        const parseResult = await parseMoveCommand(userMessage);
        
        if (parseResult.success && parseResult.parsedMove) {
          const moveExecuted = executeMove(parseResult.parsedMove);
          
          if (moveExecuted) {
            const moveNotation = parseResult.parsedMove.move_san || 
              `${parseResult.parsedMove.from_square}-${parseResult.parsedMove.to_square}`;
            
            const assistantMsg: Message = {
              id: generateMessageId(),
              role: 'assistant',
              content: `✓ Move executed: ${moveNotation}\n\n${chessRef.current.turn() === 'w' ? "White" : "Black"} to move.`,
              moveExecuted: moveNotation,
            };
            setMessages(prev => [...prev, assistantMsg]);
            
            // Check game status
            if (chessRef.current.isCheckmate()) {
              const winner = chessRef.current.turn() === 'w' ? 'Black' : 'White';
              Alert.alert('Checkmate!', `${winner} wins!`);
            } else if (chessRef.current.isDraw()) {
              Alert.alert('Draw', 'The game is a draw!');
            } else if (chessRef.current.isCheck()) {
              setMessages(prev => [...prev, {
                id: generateMessageId(),
                role: 'assistant',
                content: '♚ Check!',
              }]);
            }
          } else {
            const assistantMsg: Message = {
              id: generateMessageId(),
              role: 'assistant',
              content: `❌ Invalid move. ${parseResult.explanation}\n\nMake sure the move is legal in the current position.`,
            };
            setMessages(prev => [...prev, assistantMsg]);
          }
        } else {
          const assistantMsg: Message = {
            id: generateMessageId(),
            role: 'assistant',
            content: `❓ I couldn't understand that move. ${parseResult.explanation}\n\nTry saying something like "knight to f3" or "pawn to e4".`,
          };
          setMessages(prev => [...prev, assistantMsg]);
        }
      } else {
        // Regular chat message - use the chat endpoint
        const response = await fetch(`${LLM_SERVICE_URL}/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: [
              {
                role: 'system',
                content: `You are an expert chess coach and analyst. Help users improve their chess skills, explain strategies, analyze positions, and answer chess-related questions concisely. Current position FEN: ${chessRef.current.fen()}`,
              },
              ...messages.slice(-10).map(m => ({ role: m.role, content: m.content })),
              { role: 'user', content: userMessage },
            ],
            max_tokens: 512,
            temperature: 0.7,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to get response from AI');
        }

        const data = await response.json();

        const assistantMsg: Message = {
          id: generateMessageId(),
          role: 'assistant',
          content: data.content || 'Sorry, I could not generate a response.',
        };

        setMessages(prev => [...prev, assistantMsg]);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMsg: Message = {
        id: generateMessageId(),
        role: 'assistant',
        content: '⚠️ Unable to connect to AI service. Make sure the Board-LLM service is running on port 8001.',
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle manual moves on the board
  const handleBoardMove = (move: { from: string; to: string }) => {
    try {
      const result = chessRef.current.move({
        from: move.from,
        to: move.to,
        promotion: 'q',
      });

      if (result) {
        setFen(chessRef.current.fen());
        setLastMove({ from: result.from, to: result.to });
        
        const moveMsg: Message = {
          id: generateMessageId(),
          role: 'assistant',
          content: `You played: ${result.san}`,
          moveExecuted: result.san,
        };
        setMessages(prev => [...prev, moveMsg]);
      }
    } catch (error) {
      console.log('Invalid move');
    }
  };

  // Reset the board
  const resetBoard = () => {
    chessRef.current.reset();
    setFen(chessRef.current.fen());
    setLastMove(null);
    setMessages(prev => [...prev, {
      id: generateMessageId(),
      role: 'assistant',
      content: '♟️ Board reset! New game started. White to move.',
    }]);
  };

  const analyzePosition = async () => {
    if (!fenInput.trim()) return;

    const userMsg: Message = {
      id: generateMessageId(),
      role: 'user',
      content: `Analyze this position: ${fenInput}`,
    };

    setMessages(prev => [...prev, userMsg]);
    setFenInput('');
    setShowFenInput(false);
    setIsLoading(true);

    try {
      const response = await fetch(`${LLM_SERVICE_URL}/analyze-chess`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fen: fenInput,
          analysis_type: 'general',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to analyze position');
      }

      const data = await response.json();

      const assistantMsg: Message = {
        id: generateMessageId(),
        role: 'assistant',
        content: data.analysis || 'Unable to analyze this position.',
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (error) {
      console.error('Error analyzing position:', error);
      const errorMsg: Message = {
        id: generateMessageId(),
        role: 'assistant',
        content: '⚠️ Unable to analyze position. Make sure the Board-LLM service is running.',
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([
      {
        id: generateMessageId(),
        role: 'assistant',
        content: "Chat cleared! How can I help you with chess today?",
      },
    ]);
  };

  const quickPrompts = [
    "Knight to f3",
    "Pawn to e4",
    "Castle kingside",
    "What should I play?",
  ];

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color="#8CB369" />
        </TouchableOpacity>
        <View style={styles.headerTitle}>
          <Icon name="psychology" size={28} color="#8CB369" />
          <Text style={styles.title}>Chess AI Coach</Text>
        </View>
        <View style={styles.headerButtons}>
          <TouchableOpacity onPress={() => setShowBoard(!showBoard)} style={styles.headerIconButton}>
            <Icon name={showBoard ? "visibility-off" : "visibility"} size={22} color="#888" />
          </TouchableOpacity>
          <TouchableOpacity onPress={resetBoard} style={styles.headerIconButton}>
            <Icon name="refresh" size={22} color="#888" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Chess Board */}
      {showBoard && (
        <View style={styles.boardContainer}>
          <View style={styles.boardWrapper}>
            <ChessBoard
              fen={fen}
              onMove={handleBoardMove}
              playerColor={playerColor}
            />
          </View>
          <View style={styles.turnIndicator}>
            <View style={[styles.turnDot, { backgroundColor: chessRef.current.turn() === 'w' ? '#fff' : '#333' }]} />
            <Text style={styles.turnText}>
              {chessRef.current.turn() === 'w' ? 'White' : 'Black'} to move
            </Text>
          </View>
        </View>
      )}

      {/* Messages */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.map(message => (
          <View
            key={message.id}
            style={[
              styles.messageBubble,
              message.role === 'user' ? styles.userMessage : styles.assistantMessage,
            ]}
          >
            {message.role === 'assistant' && (
              <Icon name="smart-toy" size={20} color="#8CB369" style={styles.messageIcon} />
            )}
            <Text
              style={[
                styles.messageText,
                message.role === 'user' ? styles.userMessageText : styles.assistantMessageText,
              ]}
            >
              {message.content}
            </Text>
          </View>
        ))}
        {isLoading && (
          <View style={[styles.messageBubble, styles.assistantMessage]}>
            <ActivityIndicator size="small" color="#8CB369" />
            <Text style={styles.loadingText}>Thinking...</Text>
          </View>
        )}
      </ScrollView>

      {/* Quick Prompts */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickPromptsContainer}>
        {quickPrompts.map((prompt, index) => (
          <TouchableOpacity
            key={index}
            style={styles.quickPrompt}
            onPress={() => sendChatMessage(prompt)}
          >
            <Text style={styles.quickPromptText}>{prompt}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={[styles.quickPrompt, styles.fenPrompt]}
          onPress={() => setShowFenInput(!showFenInput)}
        >
          <Icon name="grid-on" size={16} color="#8CB369" />
          <Text style={styles.quickPromptText}>Analyze FEN</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* FEN Input (expandable) */}
      {showFenInput && (
        <View style={styles.fenInputContainer}>
          <TextInput
            style={styles.fenTextInput}
            value={fenInput}
            onChangeText={setFenInput}
            placeholder="Paste FEN notation here..."
            placeholderTextColor="#666"
            multiline
          />
          <TouchableOpacity style={styles.fenAnalyzeButton} onPress={analyzePosition}>
            <Text style={styles.fenAnalyzeButtonText}>Analyze</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Recording Indicator */}
      {isListening && (
        <View style={styles.recordingIndicator}>
          <Animated.View style={[styles.recordingDot, { transform: [{ scale: pulseAnim }] }]} />
          <Text style={styles.recordingText}>Listening... Tap mic to stop</Text>
        </View>
      )}

      {/* Input Area */}
      <View style={styles.inputContainer}>
        {voiceSupported && (
          <TouchableOpacity
            style={[styles.micButton, isListening && styles.micButtonActive]}
            onPress={toggleListening}
            disabled={isLoading}
          >
            <Icon 
              name={isListening ? 'mic' : 'mic-none'} 
              size={24} 
              color={isListening ? '#fff' : '#8CB369'} 
            />
          </TouchableOpacity>
        )}
        <TextInput
          style={styles.textInput}
          value={inputText}
          onChangeText={setInputText}
          placeholder={isListening ? "Listening..." : "Ask about chess..."}
          placeholderTextColor="#666"
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
          onPress={() => sendChatMessage(inputText)}
          disabled={!inputText.trim() || isLoading}
        >
          <Icon name="send" size={24} color={inputText.trim() ? '#fff' : '#666'} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1A1A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 16,
    backgroundColor: '#222',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 4,
  },
  headerIconButton: {
    padding: 8,
  },
  boardContainer: {
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: '#222',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  boardWrapper: {
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#8CB369',
  },
  turnIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  turnDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#666',
  },
  turnText: {
    color: '#aaa',
    fontSize: 14,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 8,
  },
  messageBubble: {
    maxWidth: '85%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  userMessage: {
    backgroundColor: '#8CB369',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  assistantMessage: {
    backgroundColor: '#333',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  messageIcon: {
    marginRight: 8,
    marginTop: 2,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
    flex: 1,
  },
  userMessageText: {
    color: '#fff',
  },
  assistantMessageText: {
    color: '#eee',
  },
  loadingText: {
    color: '#888',
    marginLeft: 8,
    fontSize: 14,
  },
  quickPromptsContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  quickPrompt: {
    backgroundColor: '#2A2A2A',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#444',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  fenPrompt: {
    borderColor: '#8CB369',
  },
  quickPromptText: {
    color: '#ccc',
    fontSize: 13,
  },
  fenInputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#222',
    gap: 8,
  },
  fenTextInput: {
    flex: 1,
    backgroundColor: '#333',
    borderRadius: 8,
    padding: 10,
    color: '#fff',
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  fenAnalyzeButton: {
    backgroundColor: '#8CB369',
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center',
  },
  fenAnalyzeButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
    backgroundColor: '#222',
    borderTopWidth: 1,
    borderTopColor: '#333',
    alignItems: 'flex-end',
    gap: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#333',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 16,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: '#8CB369',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#444',
  },
  micButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#333',
    borderWidth: 2,
    borderColor: '#8CB369',
  },
  micButtonActive: {
    backgroundColor: '#E63946',
    borderColor: '#E63946',
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    backgroundColor: 'rgba(230, 57, 70, 0.1)',
    gap: 8,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#E63946',
  },
  recordingText: {
    color: '#E63946',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default ChessAIScreen;

