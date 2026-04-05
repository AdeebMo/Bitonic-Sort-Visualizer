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
  playbackSpeed: 3,
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
  historyBody: null,
  progressFill: null,
  stepCounter: null
};

// Helper functions for UI updates
function getStatusKey(status) {
  var normalized = status.toLowerCase();
  if (normalized.indexOf('ready') !== -1) return 'ready';
  if (normalized.indexOf('built') !== -1) return 'built';
  if (normalized.indexOf('playing') !== -1) return 'playing';
  if (normalized.indexOf('stepping') !== -1) return 'stepping';
  if (normalized.indexOf('paused') !== -1) return 'paused';
  if (normalized.indexOf('completed') !== -1 || normalized.indexOf('done') !== -1) return 'completed';
  return 'idle';
}

function updateStatus(status) {
  if (dom.statusValue) {
    dom.statusValue.textContent = status;
    dom.statusValue.setAttribute('data-state', getStatusKey(status));
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

function updateValidationMessage(message, tone) {
  if (dom.validationText) {
    dom.validationText.textContent = message;
    if (tone) {
      dom.validationText.setAttribute('data-tone', tone);
    } else {
      dom.validationText.removeAttribute('data-tone');
    }
  }
}

function updateActionText() {
  if (dom.actionText) {
    dom.actionText.textContent = appState.currentActionText;
  }
}

function updateProgress() {
  var currentStepNumber = appState.currentStepIndex >= 0 ? appState.currentStepIndex + 1 : 0;
  var totalSteps = appState.steps.length;
  var percent = totalSteps > 0 ? (currentStepNumber / totalSteps) * 100 : 0;

  if (dom.stepCounter) {
    dom.stepCounter.textContent = currentStepNumber + ' / ' + totalSteps + ' steps';
  }

  if (dom.progressFill) {
    dom.progressFill.style.width = percent + '%';
  }
}

function updatePresetSelection() {
  dom.presetButtons.forEach(function(btn) {
    btn.classList.toggle('is-selected', btn.getAttribute('data-preset') === appState.selectedPreset);
  });
}

function clearPlaybackTimer() {
  appState.isPlaying = false;
  if (appState.playTimer) {
    clearInterval(appState.playTimer);
    appState.playTimer = null;
  }
}

function beginPlaybackLoop() {
  appState.playTimer = setInterval(function() {
    if (appState.currentStepIndex >= appState.steps.length - 1) {
      clearPlaybackTimer();
      updateStatus('Done');
      appState.currentActionText = 'All comparator passes complete. The array is fully sorted.';
      updateActionText();
      setButtonStates();
      return;
    }
    handleStep();
  }, 1000 / appState.playbackSpeed);
}

function setButtonStates() {
  if (dom.buildStepsBtn) dom.buildStepsBtn.disabled = !appState.isLoaded;
  if (dom.stepBtn) dom.stepBtn.disabled = !appState.isBuilt || appState.isPlaying || appState.currentStepIndex >= appState.steps.length - 1;
  if (dom.playBtn) dom.playBtn.disabled = !appState.isBuilt || appState.isPlaying || appState.currentStepIndex >= appState.steps.length - 1;
  if (dom.pauseBtn) dom.pauseBtn.disabled = !appState.isPlaying;
  if (dom.resetBtn) dom.resetBtn.disabled = !appState.isLoaded && !appState.rawInput;
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
    if (!/^-?\d+$/.test(tokens[i])) {
      return { valid: false, message: 'All values must be valid integers.', numbers: [] };
    }
    var num = parseInt(tokens[i], 10);
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

function handleInputChange(source) {
  var input = dom.customInput.value.trim();
  appState.rawInput = input;
  clearPlaybackTimer();

  if (source !== 'preset') {
    appState.selectedPreset = null;
    updatePresetSelection();
  }

  if (input === '') {
    appState.numbersLoaded = [];
    appState.workingNumbers = [];
    appState.inputSize = 0;
    appState.isLoaded = false;
    appState.isBuilt = false;
    appState.steps = [];
    appState.currentStepIndex = -1;
    appState.processedCount = 0;
    appState.currentActionText = 'Waiting for input.';
    updateValidationMessage('Enter a comma-separated list of integers. The list must have a length that is a power of 2.');
    updateInputSize(0);
    updateProcessedCount(0);
    updateActionText();
    updateStatus('Idle');
    updateProgress();
    showNetworkPlaceholder();
    renderHistory();
    setButtonStates();
    return;
  }

  var result = parseInput(input);
  appState.parsedCandidateNumbers = result.numbers;
  appState.validationMessage = result.message;

  if (result.valid) {
    appState.numbersLoaded = result.numbers.slice();
    appState.workingNumbers = result.numbers.slice();
    appState.inputSize = result.numbers.length;
    appState.isLoaded = true;
    appState.isBuilt = false;
    appState.steps = [];
    appState.currentStepIndex = -1;
    appState.processedCount = 0;
    appState.currentActionText = 'Input accepted. Build the comparator passes when you are ready.';
    updateValidationMessage('Valid input detected. Build steps to generate the network trace.', 'success');
    updateInputSize(appState.inputSize);
    updateProcessedCount(0);
    updateActionText();
    updateStatus('Ready');
    updateProgress();
    renderNetwork();
    renderHistory();
  } else {
    appState.numbersLoaded = [];
    appState.workingNumbers = [];
    appState.inputSize = 0;
    appState.isLoaded = false;
    appState.isBuilt = false;
    appState.steps = [];
    appState.currentStepIndex = -1;
    appState.processedCount = 0;
    appState.currentActionText = 'Waiting for valid input.';
    updateValidationMessage(result.message, 'error');
    updateInputSize(0);
    updateProcessedCount(0);
    updateActionText();
    updateStatus('Idle');
    updateProgress();
    showNetworkPlaceholder();
    renderHistory();
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
  if (appState.isPlaying) {
    clearInterval(appState.playTimer);
    beginPlaybackLoop();
  }
}

// Bitonic network generation
function generateBitonicNetwork(size) {
  var stages = [];
  var passNumber = 1;
  for (var k = 2; k <= size; k = 2 * k) {
    for (var j = k / 2; j > 0; j = j / 2) {
      var stageComparators = [];
      for (var i = 0; i < size; i++) {
        var l = i ^ j;
        if (l > i) {
          stageComparators.push([i, l]);
        }
      }
      stages.push({
        label: 'P' + passNumber++,
        comparators: stageComparators
      });
    }
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
          var leadingValue = dir === 'ASC' ? 'smaller' : 'larger';
          steps.push({
            index: stepIndex++,
            i: i,
            j: l,
            dir: dir,
            beforeValues: before,
            afterValues: after,
            swapped: shouldSwap,
            actionText: shouldSwap ?
              'Swapped ' + before[i] + ' and ' + before[l] + ' because ' + dir.toLowerCase() + ' order requires the ' + leadingValue + ' value first.' :
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
  var wireSpacing = Math.max(34, Math.floor(420 / appState.inputSize));
  var stageSpacing = network.stages.length > 8 ? 84 : 96;
  var labelWidth = 72;
  var rightGutter = 96;
  var stageLabelHeight = 36;
  var stageStartX = labelWidth + 12;
  var totalWidth = stageStartX + network.stages.length * stageSpacing + rightGutter;
  var totalHeight = stageLabelHeight + appState.inputSize * wireSpacing + 24;
  var svg = createSvgElement('svg', {
    class: 'network-svg',
    width: totalWidth,
    height: totalHeight
  });

  svg.setAttribute('viewBox', '0 0 ' + totalWidth + ' ' + totalHeight);

  // Draw horizontal wires with labels and values
  for (var i = 0; i < appState.inputSize; i++) {
    var y = stageLabelHeight + i * wireSpacing + wireSpacing / 2;
    var line = createSvgElement('line', {
      class: 'network-wire',
      x1: stageStartX,
      y1: y,
      x2: totalWidth - rightGutter,
      y2: y
    });
    svg.appendChild(line);

    var text = createSvgElement('text', {
      class: 'network-wire-label',
      x: labelWidth - 6,
      y: y + 4,
      textContent: i
    });
    svg.appendChild(text);

    var valueText = createSvgElement('text', {
      class: 'network-value-text',
      id: 'value-text-' + i,
      x: totalWidth - 18,
      y: y + 4,
      textContent: appState.workingNumbers[i]
    });
    svg.appendChild(valueText);
  }

  // Draw stages with comparators
  var xOffset = stageStartX;
  var comparatorIndex = 0;
  network.stages.forEach(function(stage) {
    var stageCenter = xOffset + stageSpacing / 2;
    var rect = createSvgElement('rect', {
      class: 'network-stage-band',
      x: xOffset,
      y: 8,
      width: stageSpacing,
      height: totalHeight - 16,
      rx: 20,
      ry: 20
    });
    svg.appendChild(rect);

    var text = createSvgElement('text', {
      class: 'network-stage-label',
      x: stageCenter,
      y: 24,
      textContent: stage.label
    });
    svg.appendChild(text);

    stage.comparators.forEach(function(comp) {
      var y1 = stageLabelHeight + comp[0] * wireSpacing + wireSpacing / 2;
      var y2 = stageLabelHeight + comp[1] * wireSpacing + wireSpacing / 2;

      var g = createSvgElement('g', { class: 'network-comparator', id: 'comparator-' + comparatorIndex });

      var line = createSvgElement('line', {
        class: 'network-comparator-line',
        x1: stageCenter,
        y1: y1,
        x2: stageCenter,
        y2: y2
      });
      g.appendChild(line);

      var circle1 = createSvgElement('circle', {
        class: 'network-comparator-node',
        cx: stageCenter,
        cy: y1,
        r: 4
      });
      g.appendChild(circle1);

      var circle2 = createSvgElement('circle', {
        class: 'network-comparator-node',
        cx: stageCenter,
        cy: y2,
        r: 4
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
  placeholder.className = 'placeholder-box';
  placeholder.textContent = 'Load a valid power-of-two list to generate the comparator network and inspect each pass.';
  dom.networkVisual.appendChild(placeholder);
}

function renderHistory() {
  if (!dom.historyBody) return;
  dom.historyBody.innerHTML = '';
  if (appState.steps.length === 0) {
    var row = document.createElement('tr');
    row.innerHTML = '<td colspan="6" class="cell-muted">No comparator passes yet. Build steps to populate the trace.</td>';
    dom.historyBody.appendChild(row);
    return;
  }
  appState.steps.forEach(function(step, index) {
    var row = document.createElement('tr');
    var comparedValues = step.beforeValues[step.i] + ' vs ' + step.beforeValues[step.j];
    var actionLabel = step.swapped ? 'Compare + swap' : 'Compare only';
    var resultLabel = step.swapped ? 'Swapped' : 'Kept order';
    var resultClass = step.swapped ? 'swap-yes' : 'swap-no';
    if (index === appState.currentStepIndex) {
      row.className = 'current-step';
    }
    row.innerHTML =
      '<td>' + (index + 1) + '</td>' +
      '<td>(' + step.i + ', ' + step.j + ')</td>' +
      '<td>' + comparedValues + '</td>' +
      '<td>' + step.dir + '</td>' +
      '<td>' + actionLabel + '</td>' +
      '<td><span class="result-pill ' + resultClass + '">' + resultLabel + '</span></td>';
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
    appState.selectedPreset = preset;
    updatePresetSelection();
    dom.customInput.value = list;
    handleInputChange('preset');
  }
}

function handleBuildSteps() {
  clearPlaybackTimer();
  appState.steps = generateSteps(appState.numbersLoaded);
  appState.workingNumbers = appState.numbersLoaded.slice();
  appState.currentStepIndex = -1;
  appState.processedCount = 0;
  appState.isBuilt = true;
  appState.currentActionText = 'Comparator passes generated. Step through them or autoplay the full trace.';
  updateActionText();
  updateStatus('Built');
  updateProgress();
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
  updateStatus(appState.isPlaying ? 'Playing' : 'Stepping');
  updateProgress();
  renderNetwork();
  renderHistory();
  if (appState.currentStepIndex === appState.steps.length - 1) {
    if (appState.isPlaying) {
      clearPlaybackTimer();
    }
    updateStatus('Done');
  }
  setButtonStates();
}

function handlePlay() {
  if (!appState.isBuilt || appState.currentStepIndex >= appState.steps.length - 1) return;
  clearPlaybackTimer();
  appState.isPlaying = true;
  updateStatus('Playing');
  setButtonStates();
  beginPlaybackLoop();
}

function handlePause() {
  clearPlaybackTimer();
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
  appState.currentActionText = 'Waiting for input.';
  clearPlaybackTimer();
  updatePresetSelection();

  if (dom.customInput) dom.customInput.value = '';
  updateValidationMessage('Enter a comma-separated list of integers. The list must have a length that is a power of 2.');
  updateStatus('Idle');
  updateInputSize(0);
  updateProcessedCount(0);
  updateActionText();
  updateProgress();
  showNetworkPlaceholder();
  renderHistory();
  setButtonStates();
}

// Initialization
document.addEventListener('DOMContentLoaded', function () {
  dom.customInput = document.getElementById('custom-input');
  dom.validationText = document.getElementById('input-help');
  dom.presetButtons = document.querySelectorAll('[data-preset]');
  dom.speedRange = document.getElementById('speed-range');
  dom.buildStepsBtn = document.getElementById('build-steps-btn');
  dom.stepBtn = document.getElementById('step-btn');
  dom.playBtn = document.getElementById('play-btn');
  dom.pauseBtn = document.getElementById('pause-btn');
  dom.resetBtn = document.getElementById('reset-btn');
  dom.statusValue = document.getElementById('status-value');
  dom.inputSizeValue = document.getElementById('input-size-value');
  dom.processedValue = document.getElementById('processed-value');
  dom.actionText = document.getElementById('action-text');
  dom.speedValue = document.getElementById('speed-value');
  dom.networkVisual = document.querySelector('.network-visual');
  dom.historyBody = document.getElementById('history-body');
  dom.progressFill = document.getElementById('progress-fill');
  dom.stepCounter = document.getElementById('step-counter');

  updateStatus('Idle');
  updateInputSize(0);
  updateProcessedCount(0);
  updateActionText();
  updateProgress();
  showNetworkPlaceholder();
  renderHistory();
  setButtonStates();
  handleSpeedChange();

  if (dom.customInput) {
    dom.customInput.addEventListener('input', function() {
      handleInputChange();
    });
  }

  dom.presetButtons.forEach(function(btn) {
    btn.addEventListener('click', function() {
      handlePresetClick(btn.getAttribute('data-preset'));
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
