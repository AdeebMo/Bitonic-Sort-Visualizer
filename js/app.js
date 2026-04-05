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
  actionText: null,
  networkVisual: null
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
    updateActionText('Network loaded for ' + appState.inputSize + ' inputs. Ready to build steps.');
    updateStatus('Ready');
    renderBitonicNetwork(appState.inputSize);
  } else {
    appState.isLoaded = false;
    appState.isBuilt = false;
    updateStatus('Idle');
    updateActionText('Waiting for valid input.');
    showNetworkPlaceholder();
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
  showNetworkPlaceholder();
  setButtonStates();
}

// Bitonic network generation and rendering
function generateBitonicNetwork(size) {
  // Generate the fixed Bitonic sorting network structure for a given power-of-two size
  // Returns { stages: [ { label: 'Stage 1', comparators: [[i1,j1], ...] }, ... ] }
  var allComparators = [];

  // Recursive function to collect comparators in order
  function bitonicMerge(lo, n, dir) {
    if (n > 1) {
      var m = n / 2;
      for (var i = lo; i < lo + m; i++) {
        allComparators.push([i, i + m]);
      }
      bitonicMerge(lo, m, dir);
      bitonicMerge(lo + m, m, dir);
    }
  }

  function bitonicSort(lo, n, dir) {
    if (n > 1) {
      var k = n / 2;
      bitonicSort(lo, k, 1); // ASC
      bitonicSort(lo + k, k, 0); // DESC
      bitonicMerge(lo, n, dir);
    }
  }

  bitonicSort(0, size, 1); // Start with ASC

  // Group comparators into stages: each stage has size/2 comparators
  var numStages = Math.log2(size);
  var comparatorsPerStage = size / 2;
  var stages = [];
  for (var s = 0; s < numStages; s++) {
    var start = s * comparatorsPerStage;
    var end = start + comparatorsPerStage;
    stages.push({
      label: 'Stage ' + (s + 1),
      comparators: allComparators.slice(start, end)
    });
  }

  return { stages: stages };
}

function renderBitonicNetwork(size) {
  if (size < 2 || (size & (size - 1)) !== 0) return; // Ensure power of 2

  var network = generateBitonicNetwork(size);
  var svg = createSvgElement('svg', { class: 'network-svg', width: '100%', height: '400' });

  // Layout parameters
  var wireSpacing = 30;
  var stageSpacing = 80;
  var labelWidth = 40;
  var stageLabelHeight = 20;
  var totalWidth = labelWidth + network.stages.length * stageSpacing;
  var totalHeight = stageLabelHeight + size * wireSpacing;

  svg.setAttribute('viewBox', '0 0 ' + totalWidth + ' ' + totalHeight);

  // Draw horizontal wires
  for (var i = 0; i < size; i++) {
    var y = stageLabelHeight + i * wireSpacing + wireSpacing / 2;
    var line = createSvgElement('line', {
      class: 'network-wire',
      x1: labelWidth,
      y1: y,
      x2: totalWidth,
      y2: y
    });
    svg.appendChild(line);

    // Wire label on the left
    var text = createSvgElement('text', {
      class: 'network-wire-label',
      x: 10,
      y: y + 5,
      textContent: i
    });
    svg.appendChild(text);
  }

  // Draw stages
  var xOffset = labelWidth;
  network.stages.forEach(function(stage) {
    // Stage label at the top
    var text = createSvgElement('text', {
      class: 'network-stage-label',
      x: xOffset + stageSpacing / 2,
      y: 15,
      textContent: stage.label
    });
    svg.appendChild(text);

    // Subtle stage background band
    var rect = createSvgElement('rect', {
      class: 'network-stage-band',
      x: xOffset,
      y: 0,
      width: stageSpacing,
      height: totalHeight,
      fill: 'rgba(255,255,255,0.05)'
    });
    svg.appendChild(rect);

    // Draw comparators for this stage
    stage.comparators.forEach(function(comp) {
      var y1 = stageLabelHeight + comp[0] * wireSpacing + wireSpacing / 2;
      var y2 = stageLabelHeight + comp[1] * wireSpacing + wireSpacing / 2;

      // Vertical comparator line
      var line = createSvgElement('line', {
        class: 'network-comparator-line',
        x1: xOffset + stageSpacing / 2,
        y1: y1,
        x2: xOffset + stageSpacing / 2,
        y2: y2
      });
      svg.appendChild(line);

      // Circles at endpoints
      var circle1 = createSvgElement('circle', {
        class: 'network-comparator-node',
        cx: xOffset + stageSpacing / 2,
        cy: y1,
        r: 3
      });
      svg.appendChild(circle1);

      var circle2 = createSvgElement('circle', {
        class: 'network-comparator-node',
        cx: xOffset + stageSpacing / 2,
        cy: y2,
        r: 3
      });
      svg.appendChild(circle2);
    });

    xOffset += stageSpacing;
  });

  clearNetworkVisual();
  dom.networkVisual.appendChild(svg);
}

function createSvgElement(tag, attrs) {
  var el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (var key in attrs) {
    if (key === 'textContent') {
      el.textContent = attrs[key];
    } else {
      el.setAttribute(key, attrs[key]);
    }
  }
  return el;
}

function clearNetworkVisual() {
  if (dom.networkVisual) {
    dom.networkVisual.innerHTML = '';
  }
}

function showNetworkPlaceholder(message) {
  clearNetworkVisual();
  var placeholder = document.createElement('div');
  placeholder.className = 'placeholder-box network-empty-state';
  placeholder.textContent = message || 'Enter a valid power-of-two list to see the network.';
  if (dom.networkVisual) {
    dom.networkVisual.appendChild(placeholder);
  }
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
  dom.networkVisual = document.querySelector('.network-visual');

  // Initial state
  updateStatus('Idle');
  updateInputSize(0);
  updateProcessedCount(0);
  updateActionText('Waiting for input.');
  showNetworkPlaceholder();
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
