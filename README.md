# Text-to-Speech Implementation using Multimodal Live API

This project extends the [Multimodal Live API Web Console](https://github.com/google-gemini/multimodal-live-api-web-console) to implement text-to-speech functionality using Gemini's audio capabilities. The implementation is primarily in `src/components/text-to-speech/TextToSpeech.tsx`.

## Features

- **Text-to-Speech Conversion**: Convert any text to natural-sounding speech
- **Multiple Voice Options**: Choose from different voices:
  - Puck
  - Charon
  - Kore
  - Fenrir
  - Aoede
- **Customizable Prompts**: Modify how the AI processes your text
- **Real-time Audio Streaming**: Hear the speech as it's being generated
- **Audio Download**: Save generated speech as WAV files
- **Error Handling**: Robust error handling with retry mechanisms

## Quick Start

1. Get your [Gemini API key](https://aistudio.google.com/apikey)
2. Set up the project:
```bash
# Clone the repository
git clone https://github.com/Muhtasham/text-to-speech-gemini.git
cd text-to-speech-gemini

# Install dependencies
npm install

# Create .env file and add your API key
echo "GEMINI_API_KEY=your_api_key_here" > .env

# Start the development server
npm start
```

## Using the Text-to-Speech Component

1. Open http://localhost:3000 in your browser
2. Click "Show Settings" to access:
   - Voice selection dropdown
   - Custom prompt configuration
3. Enter your text in the main textarea
4. Click "Speak" to generate and play the audio
5. Use "Download Audio" to save as WAV file

## Implementation Details

The text-to-speech functionality is implemented in `TextToSpeech.tsx` with these key features:

```typescript
// Key components:
- AudioStreamer for real-time audio playback
- Voice selection from available options
- Customizable prompts with default:
  "Please convert this text to speech and recite it verbatim do not start with sure here it is etc:"
- WAV file generation for downloads
```

## Original Project Attribution

This project is based on the [Multimodal Live API Web Console](https://github.com/google-gemini/multimodal-live-api-web-console) by Google. The original project provides modules for streaming audio playback, recording user media, and a unified log view.

## Development

Built with:
- React + TypeScript
- Web Audio API
- Gemini's Multimodal Live API
- SCSS for styling

## License

This project maintains the original Apache License 2.0 from the base project.

---

_This is an extension of an experiment showcasing the Multimodal Live API, not an official Google product. The original disclaimer and terms apply. See [Google's policy](https://developers.google.com/terms/site-policies) for more information._
