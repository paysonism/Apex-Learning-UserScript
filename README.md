# Apex Quiz Auto-Answer

Highlights Correct Answers in Apex Learning Quiz Menus. Includes Image Support, AI Logic, Auto-Complete, and Keybind Controls

Please star the repository and support my other projects as I work hard to make these tools!!!

Made with ❤ By [Payson](https://github.com/paysonism)

## Limitations

- 15 Questions per Minute
- 1,500 Questions/API Requests per 24hrs.

## Features

- **Automatic**: Detects new quiz questions and highlights the correct answer
- **Vision Support**: Analyzes images in questions (diagrams, charts, molecular structures, etc.)
- **Image Optimization**: Automatically compresses images to 800x800 pixels to save tokens
- **Correct Answer Highlighting**: Changes answer text to green with bold font weight
- **Progress Indicator**: Small progress bar shows when processing
- **100% Free**: Uses Google's free Gemini API tier (1,500 requests/day)
- **Hidden Mode**: No visible buttons or notifications

## Installation

1. **Install a Userscript Manager**
   - [Tampermonkey](https://www.tampermonkey.net/) (Chrome, Firefox, Edge, Safari)
   - [Violentmonkey](https://violentmonkey.github.io/) (Chrome, Firefox)

2. **Get a Free Gemini API Key**
   - Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
   - Sign in with your Google account
   - Click "Create API Key"
   - Copy the key

3. **Install the Script**
   - Install from [Greasyfork](https://greasyfork.org/en/scripts/555878-apex-learning-quiz-cheat)
   - Open the script in your userscript manager
   - Replace `YOUR_API_KEY_HERE` on line 17 with your actual API key (from step 2)
   - Save the script

## Usage

1. Navigate to any Apex Learning quiz
2. The script will automatically:
   - Detect new questions
   - Extract text and images
   - Query Gemini AI
   - Highlight the correct answer in green

### Manual Trigger

Press **Ctrl+Shift+R** to manually reprocess the current question.

## Configuration

Edit these constants at the top of the script:

You can leave the image configs alone but if you want to use less tokens you can have it downscale the image even more.

```javascript
const DEBUG_MODE = false;          // Set to true for console logging
const MAX_IMAGE_WIDTH = 800;       // Maximum image width in pixels
const MAX_IMAGE_HEIGHT = 800;      // Maximum image height in pixels
const IMAGE_QUALITY = 0.85;        // JPEG quality (0.0 to 1.0)
