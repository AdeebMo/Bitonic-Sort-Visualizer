/* app.js
   Central app state and control logic for the Bitonic Sorting Network teaching tool.
   Manages input parsing, validation, state updates, and UI rendering.
*/

// App state object
var appState = {
  rawInput: '',
  numbersLoaded: [],
  workingNumbers: [],
  inputSize: 0,
  selectedPreset: null,
  validationMessage: '',
  steps: [],
  currentStepIndex: -1,
  processedCount: 0,
  isLoaded: false,
  isBuilt: false,
  isPlaying: false,
  playbackSpeed: 1,
  playTimer: null,
  currentActionText: 'Waiting for input.'
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
  speedValue: null,
  networkVisual: null,
  historyBody: null
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

function updateActionText() {
  if (dom.actionText) {
    dom.actionText.textContent = appState.currentActionText;
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
    appState.numbersLoaded = result.numbers.slice();
    appState.workingNumbers = result.numbers.slice();
    appState.inputSize = result.numbers.length;
    appState.isLoaded = true;
    appState.isBuilt = false;
    appState.steps = [];
    appState.currentStepIndex = -1;
    appState.processedCount = 0;
    appState.currentActionText = 'List loaded. Ready to build bitonic steps.';
    updateInputSize(appState.inputSize);
    updateProcessedCount(0);
    updateActionText();
    updateStatus('Ready');
    renderNetwork();
  } else {
    appState.isLoaded = false;
    appState.isBuilt = false;
    appState.currentActionText = 'Waiting for valid input.';
    updateActionText();
    updateStatus('Idle');
    showNetworkPlaceholder();
  }
  setButtonStates();
}

// Preset generation
function generatePreset(preset) {
  var size = 8;
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
      list = [8, 1, 7, 2, 6, 3, 5, 4];
      break;
  }
  return list.join(', ');
}

function handleSpeedChange() {
  appState.playbackSpeed = parseInt(dom.speedRange.value, 10);
  if (dom.speedValue) {
    dom.speedValue.textContent = appState.playbackSpeed + 'x';
  }
}

// Bitonic network generation
function generateBitonicNetwork(size) {
  var pairSet = new Set();
  var comparators = [];
  for (var k = 2; k <= size; k = 2 * k) {
    for (var j = k / 2; j > 0; j = j / 2) {
      for (var i = 0; i < size; i++) {
        var l = i ^ j;
        if (l > i) {
          var pair = i + ',' + l;
          if (!pairSet.has(pair)) {
            pairSet.add(pair);
            comparators.push([i, l]);
          }
        }
      }
    }
  }

  var numStages = Math.log2(size);
  var comparatorsPerStage = Math.ceil(comparators.length / numStages);
  var stages = [];
  for (var s = 0; s < numStages; s++) {
    var start = s * comparatorsPerStage;
    var end = Math.min(start + comparatorsPerStage, comparators.length);
    stages.push({
      label: 'Stage ' + (s + 1),
      comparators: comparators.slice(start, end)
    });
  }

  return { stages: stages };
}

// Step generation for bitonic sort
function generateSteps(numbers) {
  var steps = [];
  var working = numbers.slice();
  var n = numbers.length;
  var stepIndex = 0;
  for (var k = 2; k <= n; k = 2 * k) {
    for (var j = k / 2; j > 0; j = j / 2) {
      for (var i = 0; i < n; i++) {
        var l = i ^ j;
        if (l > i) {
          var before = working.slice();
          var shouldSwap = false;
          if ((i & k) == 0) {
            if (working[i] > working[l]) shouldSwap = true;
          } else {
            if (working[i] < working[l]) shouldSwap = true;
          }
          if (shouldSwap) {
            var temp = working[i];
            working[i] = working[l];
            working[l] = temp;
          }
          var after = working.slice();
          var dir = (i & k) == 0 ? 'ASC' : 'DESC';
          steps.push({
            index: stepIndex++,
            i: i,
            j: l,
            dir: dir,
            beforeValues: before,
            afterValues: after,
            swapped: shouldSwap,
            actionText: shouldSwap ?
              'Swapped ' + before[i] + ' and ' + before[l] + ' because ' + dir.toLowerCase() + ' order requires the smaller value first.' :
              'No swap needed. Values already satisfy ' + dir.toLowerCase() + ' order.'
          });
        }
      }
    }
  }
  return steps;
}

// Network rendering
function renderNetwork() {
  if (!appState.isLoaded) {
    showNetworkPlaceholder();
    return;
  }

  var network = generateBitonicNetwork(appState.inputSize);
  var svg = createSvgElement('svg', { class: 'network-svg', width: '100%', height: '400' });

  var wireSpacing = 30;
  var stageSpacing = 80;
  var labelWidth = 40;
  var stageLabelHeight = 20;
  var totalWidth = labelWidth + network.stages.length * stageSpacing + 80;
  var totalHeight = stageLabelHeight + appState.inputSize * wireSpacing;

  svg.setAttribute('viewBox', '0 0 ' + totalWidth + ' ' + totalHeight);

  // Draw horizontal wires with labels and values
  for (var i = 0; i < appState.inputSize; i++) {
    var y = stageLabelHeight + i * wireSpacing + wireSpacing / 2;
    var line = createSvgElement('line', {
      class: 'network-wire',
      x1: labelWidth,
      y1: y,
      x2: totalWidth - 80,
      y2: y
    });
    svg.appendChild(line);

    var text = createSvgElement('text', {
      class: 'network-wire-label',
      x: 35,
      y: y + 5,
      textContent: i
    });
    svg.appendChild(text);

    var valueText = createSvgElement('text', {
      class: 'network-value-text',
      id: 'value-text-' + i,
      x: totalWidth - 60,
      y: y + 5,
      textContent: appState.workingNumbers[i]
    });
    svg.appendChild(valueText);
  }

  // Draw stages with comparators
  var xOffset = labelWidth;
  var comparatorIndex = 0;
  network.stages.forEach(function(stage) {
    var text = createSvgElement('text', {
      class: 'network-stage-label',
      x: xOffset + stageSpacing / 2,
      y: 15,
      textContent: stage.label
    });
    svg.appendChild(text);

    var rect = createSvgElement('rect', {
      class: 'network-stage-band',
      x: xOffset,
      y: 0,
      width: stageSpacing,
      height: totalHeight,
      fill: 'rgba(255,255,255,0.05)'
    });
    svg.appendChild(rect);

    stage.comparators.forEach(function(comp) {
      var y1 = stageLabelHeight + comp[0] * wireSpacing + wireSpacing / 2;
      var y2 = stageLabelHeight + comp[1] * wireSpacing + wireSpacing / 2;

      var g = createSvgElement('g', { class: 'network-comparator', id: 'comparator-' + comparatorIndex });

      var line = createSvgElement('line', {
        class: 'network-comparator-line',
        x1: xOffset + stageSpacing / 2,
        y1: y1,
        x2: xOffset + stageSpacing / 2,
        y2: y2
      });
      g.appendChild(line);

      var circle1 = createSvgElement('circle', {
        class: 'network-comparator-node',
        cx: xOffset + stageSpacing / 2,
        cy: y1,
        r: 3
      });
      g.appendChild(circle1);

      var circle2 = createSvgElement('circle', {
        class: 'network-comparator-node',
        cx: xOffset + stageSpacing / 2,
        cy: y2,
        r: 3
      });
      g.appendChild(circle2);

      svg.appendChild(g);
      comparatorIndex++;
    });

    xOffset += stageSpacing;
  });

  clearNetworkVisual();
  dom.networkVisual.appendChild(svg);
  renderValues();
  updateComparatorStates();
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

function renderValues() {
  for (var i = 0; i < appState.workingNumbers.length; i++) {
    var textEl = document.getElementById('value-text-' + i);
    if (textEl) {
      textEl.textContent = appState.workingNumbers[i];
      textEl.classList.remove('compared', 'swapped');
      if (appState.currentStepIndex >= 0 && appState.steps[appState.currentStepIndex]) {
        var step = appState.steps[appState.currentStepIndex];
        if (step.i === i || step.j === i) {
          textEl.classList.add('compared');
          if (step.swapped) {
            textEl.classList.add('swapped');
          }
        }
      }
    }
  }
}

function showNetworkPlaceholder() {
  clearNetworkVisual();
  var placeholder = document.createElement('div');
  placeholder.className = 'network-placeholder';
  placeholder.textContent = 'Enter a valid list to visualize the bitonic sorting network.';
  dom.networkVisual.appendChild(placeholder);
}

function renderHistory() {
  if (!dom.historyBody) return;
  dom.historyBody.innerHTML = '';
  if (appState.steps.length === 0) {
    var row = document.createElement('tr');
    row.innerHTML = '<td colspan="4">No steps yet. Build steps to see history.</td>';
    dom.historyBody.appendChild(row);
    return;
  }
  appState.steps.forEach(function(step, index) {
    var row = document.createElement('tr');
    if (index === appState.currentStepIndex) {
      row.className = 'current-step';
    }
    row.innerHTML = '<td>' + (index + 1) + '</td><td>(' + step.i + ', ' + step.j + ')</td><td>' + step.dir + '</td><td>' + step.actionText + '</td>';
    dom.historyBody.appendChild(row);
  });
}

function updateComparatorStates() {
  var comparators = document.querySelectorAll('.network-comparator');
  comparators.forEach(function(comp) {
    comp.classList.remove('active', 'completed');
  });

  if (appState.currentStepIndex >= 0 && appState.currentStepIndex < appState.steps.length) {
    var step = appState.steps[appState.currentStepIndex];
    var compId = 'comparator-' + step.index;
    var comp = document.getElementById(compId);
    if (comp) {
      comp.classList.add('active');
    }
  }

  for (var i = 0; i <= appState.currentStepIndex; i++) {
    var step = appState.steps[i];
    var compId = 'comparator-' + step.index;
    var comp = document.getElementById(compId);
    if (comp) {
      comp.classList.add('completed');
    }
  }
}

// Event handlers
function handlePresetClick(preset) {
  var list = generatePreset(preset);
  if (dom.customInput) {
    dom.customInput.value = list;
    handleInputChange();
  }
}

function handleBuildSteps() {
  appState.steps = generateSteps(appState.numbersLoaded);
  appState.workingNumbers = appState.numbersLoaded.slice();
  appState.currentStepIndex = -1;
  appState.processedCount = 0;
  appState.isBuilt = true;
  appState.currentActionText = 'Steps built. Ready to step through or play.';
  updateActionText();
  updateStatus('Built');
  renderNetwork();
  renderHistory();
  setButtonStates();
}

function handleStep() {
  if (appState.currentStepIndex >= appState.steps.length - 1) return;
  appState.currentStepIndex++;
  var step = appState.steps[appState.currentStepIndex];
  appState.workingNumbers = step.afterValues.slice();
  appState.processedCount = appState.currentStepIndex + 1;
  appState.currentActionText = step.actionText;
  updateActionText();
  updateProcessedCount(appState.processedCount);
  updateStatus('Stepping (' + (appState.currentStepIndex + 1) + '/' + appState.steps.length + ')');
  renderNetwork();
  renderHistory();
  setButtonStates();
}

function handlePlay() {
  appState.isPlaying = true;
  updateStatus('Playing');
  setButtonStates();
  appState.playTimer = setInterval(function() {
    if (appState.currentStepIndex >= appState.steps.length - 1) {
      handlePause();
      updateStatus('Completed');
      return;
    }
    handleStep();
  }, 1000 / appState.playbackSpeed);
}

function handlePause() {
  appState.isPlaying = false;
  clearInterval(appState.playTimer);
  appState.playTimer = null;
  updateStatus('Paused');
  setButtonStates();
}

function handleReset() {
  appState.rawInput = '';
  appState.numbersLoaded = [];
  appState.workingNumbers = [];
  appState.inputSize = 0;
  appState.validationMessage = '';
  appState.selectedPreset = null;
  appState.steps = [];
  appState.currentStepIndex = -1;
  appState.processedCount = 0;
  appState.isLoaded = false;
  appState.isBuilt = false;
  appState.isPlaying = false;
  appState.currentActionText = 'Waiting for input.';
  if (appState.playTimer) {
    clearInterval(appState.playTimer);
    appState.playTimer = null;
  }

  if (dom.customInput) dom.customInput.value = '';
  updateValidationMessage('Enter a comma-separated list of integers. The list must have a length that is a power of 2.');
  updateStatus('Idle');
  updateInputSize(0);
  updateProcessedCount(0);
  updateActionText();
  showNetworkPlaceholder();
  renderHistory();
  setButtonStates();
}

// Initialization
document.addEventListener('DOMContentLoaded', function () {
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
  dom.actionText = document.getElementById('action-text');
  dom.speedValue = document.getElementById('speed-value');
  dom.networkVisual = document.querySelector('.network-visual');
  dom.historyBody = document.getElementById('history-body');

  updateStatus('Idle');
  updateInputSize(0);
  updateProcessedCount(0);
  updateActionText();
  showNetworkPlaceholder();
  renderHistory();
  setButtonStates();
  handleSpeedChange();

  if (dom.customInput) {
    dom.customInput.addEventListener('input', handleInputChange);
  }

  dom.presetButtons.forEach(function(btn, index) {
    var presets = ['random', 'sorted', 'reverse', 'zero-one', 'worst'];
    btn.addEventListener('click', function() {
      handlePresetClick(presets[index]);
    });
  });

  if (dom.speedRange) {
    dom.speedRange.addEventListener('input', handleSpeedChange);
  }

  if (dom.buildStepsBtn) {
    dom.buildStepsBtn.addEventListener('click', handleBuildSteps);
  }

  if (dom.stepBtn) {
    dom.stepBtn.addEventListener('click', handleStep);
  }

  if (dom.playBtn) {
    dom.playBtn.addEventListener('click', handlePlay);
  }

  if (dom.pauseBtn) {
    dom.pauseBtn.addEventListener('click', handlePause);
  }

  if (dom.resetBtn) {
    dom.resetBtn.addEventListener('click', handleReset);
  }
});
