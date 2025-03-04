import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AudioStreamer } from '../../lib/audio-streamer';
import { audioContext } from '../../lib/utils';
import { useLiveAPIContext } from '../../contexts/LiveAPIContext';
import './text-to-speech.scss';

const MAX_AUDIO_CHUNKS = 1000; // Prevent memory issues with very long audio
const DEFAULT_PROMPT = 'Please convert this text to speech and recite it verbatim do not start with sure here it is etc:';
const AVAILABLE_VOICES = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Aoede'] as const;

export default function TextToSpeech() {
  const [text, setText] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioStreamer, setAudioStreamer] = useState<AudioStreamer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [audioData, setAudioData] = useState<Uint8Array[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [customPrompt, setCustomPrompt] = useState(DEFAULT_PROMPT);
  const [selectedVoice, setSelectedVoice] = useState<typeof AVAILABLE_VOICES[number]>('Puck');
  const audioContextRef = useRef<AudioContext | null>(null);
  const { client, connected, connect, disconnect, setConfig } = useLiveAPIContext();

  const initializeAudioStreamer = async () => {
    if (!audioStreamer) {
      try {
        const audioCtx = await audioContext({ id: 'text-to-speech' });
        audioContextRef.current = audioCtx;
        const streamer = new AudioStreamer(audioCtx);
        setAudioStreamer(streamer);
      } catch (err) {
        setError('Failed to initialize audio. Please check your audio settings.');
        return false;
      }
    }
    return true;
  };

  const cleanupAudio = useCallback(() => {
    if (audioStreamer) {
      audioStreamer.stop();
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setAudioStreamer(null);
    setAudioData([]);
  }, [audioStreamer]);

  useEffect(() => {
    return () => {
      cleanupAudio();
    };
  }, [cleanupAudio]);

  const setupConnection = useCallback(async () => {
    if (isConnecting || connected) return;
    
    setIsConnecting(true);
    setError(null);
    
    try {
      setConfig({
        model: "models/gemini-2.0-flash-exp",
        generationConfig: {
          responseModalities: "audio",
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: selectedVoice
              }
            }
          }
        }
      });
      await connect();
    } catch (err) {
      setError('Failed to connect to speech service. Please try again.');
    } finally {
      setIsConnecting(false);
    }
  }, [connected, connect, setConfig, isConnecting, selectedVoice]);

  useEffect(() => {
    setupConnection();
  }, [setupConnection]);

  useEffect(() => {
    const onAudio = (data: ArrayBuffer) => {
      const audioChunk = new Uint8Array(data);
      setAudioData(prev => {
        // Limit stored chunks to prevent memory issues
        const newChunks = [...prev, audioChunk];
        return newChunks.slice(-MAX_AUDIO_CHUNKS);
      });
      audioStreamer?.addPCM16(audioChunk);
    };

    const onClose = (event: CloseEvent) => {
      if (event.reason?.includes('Quota exceeded')) {
        setError('API quota exceeded. Please try again in a few minutes or use a different API key.');
        disconnect();
      } else if (event.reason?.includes('ERROR')) {
        setError('Connection error. Please try again.');
      }
      setIsPlaying(false);
      cleanupAudio();
    };

    const onTurnComplete = () => {
      setIsPlaying(false);
    };

    client.on('audio', onAudio);
    client.on('close', onClose);
    client.on('turncomplete', onTurnComplete);

    return () => {
      client.off('audio', onAudio);
      client.off('close', onClose);
      client.off('turncomplete', onTurnComplete);
    };
  }, [client, audioStreamer, disconnect, cleanupAudio]);

  const handleSpeak = async () => {
    if (!text.trim() || isPlaying) return;

    setError(null);
    setAudioData([]);
    
    const initialized = await initializeAudioStreamer();
    if (!initialized) return;

    setIsPlaying(true);

    try {
      await client.send({
        text: `${customPrompt} ${text}`
      });
    } catch (err) {
      setError('Failed to send text for conversion. Please try again.');
      setIsPlaying(false);
      setAudioData([]);
      cleanupAudio();
    }
  };

  const handlePromptReset = () => {
    setCustomPrompt(DEFAULT_PROMPT);
  };

  const handleDownload = () => {
    if (audioData.length === 0) return;

    try {
      // Combine all audio chunks
      const combinedLength = audioData.reduce((acc, chunk) => acc + chunk.length, 0);
      const combinedAudio = new Uint8Array(combinedLength);
      let offset = 0;
      audioData.forEach(chunk => {
        combinedAudio.set(chunk, offset);
        offset += chunk.length;
      });

      // Create WAV header
      const sampleRate = 24000; // Standard sample rate for PCM audio
      const numChannels = 1; // Mono
      const bitsPerSample = 16; // 16-bit PCM
      const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
      const blockAlign = (numChannels * bitsPerSample) / 8;
      const wavHeader = new ArrayBuffer(44);
      const view = new DataView(wavHeader);

      // Write WAV header
      view.setUint32(0, 0x52494646); // "RIFF"
      view.setUint32(4, 36 + combinedAudio.length, true); // File size
      view.setUint32(8, 0x57415645); // "WAVE"
      view.setUint32(12, 0x666D7420); // "fmt "
      view.setUint32(16, 16, true); // Format chunk size
      view.setUint16(20, 1, true); // Audio format (PCM)
      view.setUint16(22, numChannels, true);
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, byteRate, true);
      view.setUint16(32, blockAlign, true);
      view.setUint16(34, bitsPerSample, true);
      view.setUint32(36, 0x64617461); // "data"
      view.setUint32(40, combinedAudio.length, true);

      // Combine header and audio data
      const wavBlob = new Blob([wavHeader, combinedAudio], { type: 'audio/wav' });
      const url = URL.createObjectURL(wavBlob);
      
      // Create download link
      const a = document.createElement('a');
      a.href = url;
      a.download = `speech-${new Date().toISOString()}.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError('Failed to download audio. Please try again.');
    }
  };

  const handleRetry = () => {
    setError(null);
    cleanupAudio();
    setupConnection();
  };

  const handleVoiceChange = (newVoice: typeof AVAILABLE_VOICES[number]) => {
    setSelectedVoice(newVoice);
    if (connected) {
      setIsPlaying(false);
      cleanupAudio();
      disconnect();
      // Give time for cleanup before reconnecting
      setTimeout(() => setupConnection(), 200);
    }
  };

  return (
    <div className="text-to-speech">
      <div className="settings-header">
        <h2>Text to Speech</h2>
        <button 
          onClick={() => setShowSettings(!showSettings)}
          className="settings-toggle"
        >
          {showSettings ? 'Hide Settings' : 'Show Settings'}
        </button>
      </div>

      {showSettings && (
        <div className="settings-panel">
          <div className="setting-group">
            <label htmlFor="prompt">Custom Prompt:</label>
            <div className="prompt-input-group">
              <input
                id="prompt"
                type="text"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Enter custom prompt..."
                className="prompt-input"
              />
              <button 
                onClick={handlePromptReset}
                className="reset-button"
                title="Reset to default prompt"
              >
                Reset
              </button>
            </div>
            <small className="setting-help">
              This prompt will be prepended to your text when sending to the API.
              Default: "{DEFAULT_PROMPT}"
            </small>
          </div>

          <div className="setting-group">
            <label htmlFor="voice">Voice:</label>
            <select
              id="voice"
              value={selectedVoice}
              onChange={(e) => handleVoiceChange(e.target.value as typeof AVAILABLE_VOICES[number])}
              className="voice-select"
            >
              {AVAILABLE_VOICES.map(voice => (
                <option key={voice} value={voice}>
                  {voice}
                </option>
              ))}
            </select>
            <small className="setting-help">
              Select the voice that will be used for speech synthesis.
            </small>
          </div>
        </div>
      )}

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Enter text to convert to speech..."
        rows={4}
      />
      <div className="button-group">
        <button 
          onClick={handleSpeak}
          disabled={isPlaying || !text.trim() || !connected || isConnecting}
          className="speak-button"
        >
          {isPlaying ? 'Speaking...' : 'Speak'}
        </button>
        {audioData.length > 0 && (
          <button 
            onClick={handleDownload}
            className="download-button"
          >
            Download Audio
          </button>
        )}
      </div>
      {isConnecting && (
        <div className="connection-status">
          Connecting to speech service...
        </div>
      )}
      {error && (
        <div className="error-message">
          {error}
          <button onClick={handleRetry} className="retry-button">
            Retry
          </button>
        </div>
      )}
    </div>
  );
} 