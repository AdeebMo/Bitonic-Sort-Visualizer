/* app.js
   Central app state and control logic for the Bitonic Sorting Network teaching tool.
   Manages input parsing, validation, state updates, and UI rendering.
*/

// App state object
var appState = {
  rawInput: '',
  numbers: [],
  parsedCandidateNumbers: [],
  inputSize: 0,
  validationMessage: '',
  selectedPreset: null,
  steps: [],
  currentStepIndex: -1,
  processedCount: 0,
  isLoaded: false,
  isBuilt: false,
  isPlaying: false,
  playbackSpeed: 3,
  playTimer: null
};

// Cached DOM elements
var dom = {
  customInput: null,
  validationText: null,
  presetButtons: [],
  speedRange: null,
  buildStepsBtn: null,
  stepBtn: null,
  playBtn: null,
  pauseBtn: null,
  resetBtn: null,
  statusValue: null,
  inputSizeValue: null,
  processedValue: null,
  actionText: null
};

// Helper functions for UI updates
function updateStatus(status) {
  if (dom.statusValue) {
    dom.statusValue.textContent = status;
  }
}

function updateInputSize(size) {
  if (dom.inputSizeValue) {
    dom.inputSizeValue.textContent = size;
  }
}

function updateProcessedCount(count) {
  if (dom.processedValue) {
    dom.processedValue.textContent = count;
  }
}

function updateValidationMessage(message) {
  if (dom.validationText) {
    dom.validationText.textContent = message;
  }
}

function updateActionText(text) {
  if (dom.actionText) {
    dom.actionText.textContent = text;
  }
}

function setButtonStates() {
  if (dom.buildStepsBtn) dom.buildStepsBtn.disabled = !appState.isLoaded;
  if (dom.stepBtn) dom.stepBtn.disabled = !appState.isBuilt;
  if (dom.playBtn) dom.playBtn.disabled = !appState.isBuilt || appState.isPlaying;
  if (dom.pauseBtn) dom.pauseBtn.disabled = !appState.isPlaying;
}

// Input parsing and validation
function parseInput(input) {
  var tokens = input.split(',').map(function(token) {
    return token.trim();
  }).filter(function(token) {
    return token !== '';
  });

  var numbers = [];
  for (var i = 0; i < tokens.length; i++) {
    var num = parseInt(tokens[i], 10);
    if (isNaN(num)) {
      return { valid: false, message: 'All values must be valid integers.', numbers: [] };
    }
    numbers.push(num);
  }

  if (numbers.length < 2) {
    return { valid: false, message: 'List must contain at least 2 numbers.', numbers: [] };
  }

  if (!isPowerOfTwo(numbers.length)) {
    return { valid: false, message: 'List length must be a power of 2 (e.g., 2, 4, 8, 16).', numbers: [] };
  }

  return { valid: true, message: '', numbers: numbers };
}

function isPowerOfTwo(n) {
  return n > 0 && (n & (n - 1)) === 0;
}

function handleInputChange() {
  var input = dom.customInput.value.trim();
  appState.rawInput = input;
  var result = parseInput(input);
  appState.parsedCandidateNumbers = result.numbers;
  appState.validationMessage = result.message;
  updateValidationMessage(result.message);

  if (result.valid) {
    appState.numbers = result.numbers.slice();
    appState.inputSize = result.numbers.length;
    appState.isLoaded = true;
    appState.isBuilt = false;
    appState.processedCount = 0;
    updateInputSize(appState.inputSize);
    updateProcessedCount(0);
    updateActionText('List loaded. Ready for step generation.');
    updateStatus('Ready');
  } else {
    appState.isLoaded = false;
    appState.isBuilt = false;
    updateStatus('Idle');
    updateActionText('Waiting for valid input.');
  }
  setButtonStates();
}

// Preset examples
function generatePreset(preset) {
  var size = 8; // Default size
  var list = [];
  switch (preset) {
    case 'random':
      for (var i = 0; i < size; i++) {
        list.push(Math.floor(Math.random() * 99) + 1);
      }
      break;
    case 'sorted':
      for (var i = 1; i <= size; i++) {
        list.push(i);
      }
      break;
    case 'reverse':
      for (var i = size; i >= 1; i--) {
        list.push(i);
      }
      break;
    case 'zero-one':
      for (var i = 0; i < size; i++) {
        list.push(i % 2);
      }
      break;
    case 'worst':
      // Example worst case: alternating high/low
      list = [8, 1, 7, 2, 6, 3, 5, 4];
      break;
  }
  return list.join(', ');
}

function handlePresetClick(preset) {
  var example = generatePreset(preset);
  dom.customInput.value = example;
  handleInputChange(); // Trigger validation
}

// Reset function
function handleReset() {
  appState.rawInput = '';
  appState.numbers = [];
  appState.parsedCandidateNumbers = [];
  appState.inputSize = 0;
  appState.validationMessage = '';
  appState.selectedPreset = null;
  appState.steps = [];
  appState.currentStepIndex = -1;
  appState.processedCount = 0;
  appState.isLoaded = false;
  appState.isBuilt = false;
  appState.isPlaying = false;
  if (appState.playTimer) {
    clearInterval(appState.playTimer);
    appState.playTimer = null;
  }

  if (dom.customInput) dom.customInput.value = '';
  updateValidationMessage('Enter a comma-separated list of integers. The list must have a length that is a power of 2.');
  updateStatus('Idle');
  updateInputSize(0);
  updateProcessedCount(0);
  updateActionText('Waiting for input.');
  setButtonStates();
}

// Initialization
document.addEventListener('DOMContentLoaded', function () {
  // Cache DOM elements
  dom.customInput = document.getElementById('custom-input');
  dom.validationText = document.getElementById('input-help');
  dom.presetButtons = document.querySelectorAll('.button-secondary');
  dom.speedRange = document.getElementById('speed-range');
  dom.buildStepsBtn = document.getElementById('build-steps-btn');
  dom.stepBtn = document.getElementById('step-btn');
  dom.playBtn = document.getElementById('play-btn');
  dom.pauseBtn = document.getElementById('pause-btn');
  dom.resetBtn = document.getElementById('reset-btn');
  dom.statusValue = document.getElementById('status-value');
  dom.inputSizeValue = document.querySelector('.status-item:nth-child(2) .status-value');
  dom.processedValue = document.querySelector('.status-item:nth-child(3) .status-value');
  dom.actionText = document.querySelector('.action-strip span');

  // Initial state
  updateStatus('Idle');
  updateInputSize(0);
  updateProcessedCount(0);
  updateActionText('Waiting for input.');
  setButtonStates();

  // Event listeners
  if (dom.customInput) {
    dom.customInput.addEventListener('input', handleInputChange);
  }

  dom.presetButtons.forEach(function(btn, index) {
    var presets = ['random', 'sorted', 'reverse', 'zero-one', 'worst'];
    btn.addEventListener('click', function() {
      handlePresetClick(presets[index]);
    });
  });

  if (dom.resetBtn) {
    dom.resetBtn.addEventListener('click', handleReset);
  }

  // Disable sorting buttons initially
  if (dom.buildStepsBtn) dom.buildStepsBtn.disabled = true;
  if (dom.stepBtn) dom.stepBtn.disabled = true;
  if (dom.playBtn) dom.playBtn.disabled = true;
  if (dom.pauseBtn) dom.pauseBtn.disabled = true;
});
