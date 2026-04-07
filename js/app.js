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
  selectedSize: 8,
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
  sizeSelect: null,
  sizeDropdown: null,
  sizeDropdownButton: null,
  sizeDropdownValue: null,
  sizeDropdownList: null,
  sizeDropdownOptions: [],
  speedRange: null,
  buildStepsBtn: null,
  clearInputBtn: null,
  restartRunBtn: null,
  stepBackBtn: null,
  stepBtn: null,
  playBtn: null,
  pauseBtn: null,
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

var DEFAULT_INPUT_HELP = 'Enter numbers separated by commas. Use a list length of 2^n (e.g., 4, 8, 16) so the network can sort them.';
var SUCCESS_INPUT_HELP = 'Valid input detected. Build steps to generate the network trace.';

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
    dom.validationText.setAttribute('role', tone === 'error' ? 'alert' : 'status');
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

function getCurrentStep() {
  if (appState.currentStepIndex < 0 || appState.currentStepIndex >= appState.steps.length) {
    return null;
  }
  return appState.steps[appState.currentStepIndex];
}

function isTraceComplete() {
  return appState.steps.length > 0 && appState.currentStepIndex >= appState.steps.length - 1;
}

function getValuePillWidth(values) {
  var maxChars = 1;
  for (var i = 0; i < values.length; i++) {
    maxChars = Math.max(maxChars, String(values[i]).length);
  }
  return Math.max(64, maxChars * 11 + 28);
}

function getStageCount(size) {
  if (!size) {
    return 0;
  }
  return generateBitonicNetwork(size).stages.length;
}

function getBuildSummaryText() {
  var stepCount = appState.steps.length;
  var stageCount = getStageCount(appState.inputSize);

  if (!stepCount || !stageCount) {
    return 'Build the comparator trace to inspect each stage.';
  }

  return 'Built ' + stepCount + ' comparator steps across ' + stageCount + ' stages. Use the controls below to move through the trace.';
}

function getNetworkVisualEl() {
  if (!dom.networkVisual) {
    dom.networkVisual = document.querySelector('.network-visual');
  }
  return dom.networkVisual;
}

function getHistoryBodyEl() {
  if (!dom.historyBody) {
    dom.historyBody = document.getElementById('history-body');
  }
  return dom.historyBody;
}

function updatePresetSelection() {
  dom.presetButtons.forEach(function(btn) {
    btn.classList.toggle('is-selected', btn.getAttribute('data-preset') === appState.selectedPreset);
  });
}

function syncSizeDropdownUI() {
  var selectedValue = String(appState.selectedSize || 8);

  if (dom.sizeSelect) {
    dom.sizeSelect.value = selectedValue;
  }

  if (dom.sizeDropdownValue) {
    var selectedOption = dom.sizeSelect ? dom.sizeSelect.querySelector('option[value="' + selectedValue + '"]') : null;
    dom.sizeDropdownValue.textContent = selectedOption ? selectedOption.textContent : selectedValue + ' Inputs';
  }

  dom.sizeDropdownOptions.forEach(function(option) {
    var isSelected = option.getAttribute('data-size-option') === selectedValue;
    option.classList.toggle('is-selected', isSelected);
    option.setAttribute('aria-selected', isSelected ? 'true' : 'false');
  });
}

function setSizeDropdownOpen(isOpen) {
  if (!dom.sizeDropdown || !dom.sizeDropdownButton || !dom.sizeDropdownList) {
    return;
  }

  dom.sizeDropdown.classList.toggle('is-open', isOpen);
  dom.sizeDropdownButton.setAttribute('aria-expanded', isOpen ? 'true' : 'false');

  if (isOpen) {
    dom.sizeDropdownList.hidden = false;
  } else {
    dom.sizeDropdownList.hidden = true;
  }
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
  if (dom.buildStepsBtn) dom.buildStepsBtn.disabled = !appState.isLoaded || appState.isPlaying;
  if (dom.clearInputBtn) dom.clearInputBtn.disabled = !appState.rawInput;
  if (dom.restartRunBtn) dom.restartRunBtn.disabled = !appState.isBuilt || appState.isPlaying;
  if (dom.stepBackBtn) dom.stepBackBtn.disabled = !appState.isBuilt || appState.isPlaying || appState.currentStepIndex < 0;
  if (dom.stepBtn) dom.stepBtn.disabled = !appState.isBuilt || appState.isPlaying || appState.currentStepIndex >= appState.steps.length - 1;
  if (dom.playBtn) dom.playBtn.disabled = !appState.isBuilt || appState.isPlaying || appState.currentStepIndex >= appState.steps.length - 1;
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
    if (!/^-?\d+$/.test(tokens[i])) {
      return {
        valid: false,
        message: 'Please enter whole numbers only. Bitonic sort uses a fixed network, so this visualizer expects power-of-two list lengths.',
        numbers: []
      };
    }
    var num = parseInt(tokens[i], 10);
    numbers.push(num);
  }

  if (numbers.length < 2) {
    return {
      valid: false,
      message: 'Enter at least two numbers. Bitonic sort in this visualizer works on power-of-two lengths such as 2, 4, 8, and 16.',
      numbers: []
    };
  }

  if (!isPowerOfTwo(numbers.length)) {
    return {
      valid: false,
      message: 'Bitonic sort uses a fixed wiring pattern, so the list length must be a power of two (2, 4, 8, 16, ...).',
      numbers: []
    };
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
    updateValidationMessage(DEFAULT_INPUT_HELP);
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
    if (dom.sizeSelect && dom.sizeSelect.querySelector('option[value="' + appState.inputSize + '"]')) {
      dom.sizeSelect.value = String(appState.inputSize);
      appState.selectedSize = appState.inputSize;
      syncSizeDropdownUI();
    }
    appState.isLoaded = true;
    appState.isBuilt = false;
    appState.steps = [];
    appState.currentStepIndex = -1;
    appState.processedCount = 0;
    appState.currentActionText = 'Input accepted. Build the comparator passes when you are ready.';
    updateValidationMessage(SUCCESS_INPUT_HELP, 'success');
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
  var size = appState.selectedSize || 8;
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
      for (var left = 1, right = size; left <= right; left++, right--) {
        if (left === right) {
          list.push(right);
        } else {
          list.push(right);
          list.push(left);
        }
      }
      break;
  }
  return list.join(', ');
}

function handleSizeChange() {
  if (!dom.sizeSelect) {
    return;
  }

  appState.selectedSize = parseInt(dom.sizeSelect.value, 10);
  syncSizeDropdownUI();
  setSizeDropdownOpen(false);

  if (appState.selectedPreset) {
    handlePresetClick(appState.selectedPreset);
  }
}

function handleSizeOptionSelect(value) {
  if (!dom.sizeSelect) {
    return;
  }

  dom.sizeSelect.value = value;
  handleSizeChange();
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
  var stepIndex = 0;
  for (var k = 2; k <= size; k = 2 * k) {
    for (var j = k / 2; j > 0; j = j / 2) {
      var stageComparators = [];
      for (var i = 0; i < size; i++) {
        var l = i ^ j;
        if (l > i) {
          var direction = (i & k) === 0 ? 'ASC' : 'DESC';
          stageComparators.push({
            left: i,
            right: l,
            dir: direction,
            directionLabel: direction === 'ASC' ? 'Ascending' : 'Descending',
            directionMarker: direction === 'ASC' ? 'up' : 'down',
            stepIndex: stepIndex++
          });
        }
      }
      stages.push({
        passIndex: stages.length,
        label: 'Size ' + k,
        metaLabel: 'Gap ' + j,
        descriptor: 'Size ' + k + ' / Gap ' + j,
        gap: j,
        blockSize: k,
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
  var network = generateBitonicNetwork(numbers.length);
  network.stages.forEach(function(stage) {
    stage.comparators.forEach(function(comp) {
      var before = working.slice();
      var leftValue = working[comp.left];
      var rightValue = working[comp.right];
      var shouldSwap = comp.dir === 'ASC' ? leftValue > rightValue : leftValue < rightValue;

      if (shouldSwap) {
        var temp = working[comp.left];
        working[comp.left] = working[comp.right];
        working[comp.right] = temp;
      }

      var pairText = before[comp.left] + ' vs ' + before[comp.right];
      var orderLabel = comp.dir === 'ASC' ? 'ascending' : 'descending';
      var after = working.slice();

      steps.push({
        index: comp.stepIndex,
        passIndex: stage.passIndex,
        passLabel: stage.descriptor,
        gap: stage.gap,
        blockSize: stage.blockSize,
        i: comp.left,
        j: comp.right,
        dir: comp.dir,
        beforeValues: before,
        afterValues: after,
        swapped: shouldSwap,
        comparedValues: pairText,
        actionLabel: 'Compare for ' + comp.dir,
        resultLabel: shouldSwap ? 'Swapped' : 'Kept Order',
        actionText: shouldSwap ?
          stage.descriptor + ' - Swap wires ' + comp.left + ' and ' + comp.right + ' (' + pairText + ') for ' + orderLabel + ' order.' :
          stage.descriptor + ' - Keep wires ' + comp.left + ' and ' + comp.right + ' (' + pairText + ') for ' + orderLabel + ' order.'
      });
    });
  });
  return steps;
}

// Network rendering
function renderNetwork() {
  var networkVisual = getNetworkVisualEl();
  if (!networkVisual) {
    return;
  }

  if (!appState.isLoaded) {
    showNetworkPlaceholder();
    return;
  }

  var network = generateBitonicNetwork(appState.inputSize);
  var stages = [];
  var values = appState.workingNumbers && appState.workingNumbers.length ?
    appState.workingNumbers.slice() :
    appState.numbersLoaded.slice();

  if (!appState.inputSize || values.length !== appState.inputSize) {
    showNetworkPlaceholder();
    return;
  }

  for (var stageIndex = 0; stageIndex < network.stages.length; stageIndex++) {
    if (network.stages[stageIndex] && network.stages[stageIndex].comparators && network.stages[stageIndex].comparators.length) {
      stages.push(network.stages[stageIndex]);
    }
  }

  if (stages.length === 0) {
    showNetworkPlaceholder();
    return;
  }

  var currentStep = getCurrentStep();
  var traceComplete = isTraceComplete();
  var wireSpacing = Math.max(22, Math.min(42, Math.floor(440 / appState.inputSize)));
  var stageSpacing = stages.length > 14 ? 72 : stages.length > 10 ? 78 : stages.length > 7 ? 86 : 94;
  var leftRail = 78;
  var stageStartX = leftRail;
  var valuePillWidth = getValuePillWidth(values);
  var stageAreaEndX = stageStartX + stages.length * stageSpacing;
  var wireEndX = stageAreaEndX - 16;
  var valueStartX = stageAreaEndX + 18;
  var totalWidth = valueStartX + valuePillWidth + 18;
  var stageLabelHeight = 46;
  var totalHeight = stageLabelHeight + appState.inputSize * wireSpacing + 12;
  var svg = createSvgElement('svg', {
    class: 'network-svg',
    width: totalWidth,
    height: totalHeight
  });

  svg.setAttribute('viewBox', '0 0 ' + totalWidth + ' ' + totalHeight);

  // Draw row backgrounds, horizontal wires, labels, and values
  for (var i = 0; i < appState.inputSize; i++) {
    var y = stageLabelHeight + i * wireSpacing + wireSpacing / 2;
    var isCompared = !traceComplete && currentStep && (currentStep.i === i || currentStep.j === i);
    var rowBand = createSvgElement('rect', {
      class: 'network-row-band' + (i % 2 === 0 ? '' : ' is-odd'),
      x: stageStartX - 10,
      y: y - (wireSpacing / 2) + 6,
      width: wireEndX - stageStartX + 20,
      height: wireSpacing - 10,
      rx: 14,
      ry: 14
    });
    svg.appendChild(rowBand);

    var line = createSvgElement('line', {
      class: 'network-wire' + (isCompared ? ' active' : ''),
      id: 'wire-' + i,
      x1: stageStartX,
      y1: y,
      x2: wireEndX,
      y2: y
    });
    svg.appendChild(line);

    var labelGroup = createSvgElement('g', { class: 'network-index-pill' });
    var labelRect = createSvgElement('rect', {
      class: 'network-index-pill-bg',
      x: 18,
      y: y - 14,
      width: 40,
      height: 28,
      rx: 14,
      ry: 14
    });
    labelGroup.appendChild(labelRect);

    var text = createSvgElement('text', {
      class: 'network-index-pill-text',
      x: 38,
      y: y + 3,
      textContent: i
    });
    labelGroup.appendChild(text);
    svg.appendChild(labelGroup);

    var valueGroup = createSvgElement('g', { class: 'network-value-pill' });
    var valueRect = createSvgElement('rect', {
      class: 'network-value-pill-bg' + (isCompared ? ' compared' : ''),
      id: 'value-pill-bg-' + i,
      x: valueStartX,
      y: y - 15,
      width: valuePillWidth,
      height: 30,
      rx: 15,
      ry: 15
    });
    valueGroup.appendChild(valueRect);

    var valueText = createSvgElement('text', {
      class: 'network-value-pill-text' + (isCompared ? ' compared' : ''),
      id: 'value-text-' + i,
      x: valueStartX + valuePillWidth / 2,
      y: y + 3,
      textContent: values[i]
    });
    valueGroup.appendChild(valueText);
    svg.appendChild(valueGroup);
  }

  // Draw stages with comparators
  var xOffset = stageStartX;
  stages.forEach(function(stage) {
    var stageCenter = xOffset + stageSpacing / 2;
    var stageBandInset = 1;
    var stageBandWidth = Math.max(12, stageSpacing - 2);
    var lastComparator = stage.comparators[stage.comparators.length - 1];
    var stageLastStep = lastComparator ? lastComparator.stepIndex : -1;
    var stageStateClass = '';
    if (traceComplete) {
      stageStateClass = ' completed';
    } else if (currentStep) {
      if (currentStep.passIndex === stage.passIndex) {
        stageStateClass = ' active';
      } else if (appState.currentStepIndex > stageLastStep) {
        stageStateClass = ' completed';
      }
    }

    var rect = createSvgElement('rect', {
      class: 'network-stage-band' + stageStateClass,
      x: xOffset + stageBandInset,
      y: 8,
      width: stageBandWidth,
      height: totalHeight - 14,
      rx: 20,
      ry: 20
    });
    svg.appendChild(rect);

    var text = createSvgElement('text', {
      class: 'network-stage-label',
      x: stageCenter,
      y: 28,
      textContent: stage.label
    });
    svg.appendChild(text);

    var meta = createSvgElement('text', {
      class: 'network-stage-meta',
      x: stageCenter,
      y: 40,
      textContent: stage.metaLabel
    });
    svg.appendChild(meta);

    stage.comparators.forEach(function(comp) {
      var y1 = stageLabelHeight + comp.left * wireSpacing + wireSpacing / 2;
      var y2 = stageLabelHeight + comp.right * wireSpacing + wireSpacing / 2;
      var directionChipX = stageCenter + Math.min(14, Math.max(10, Math.floor(stageSpacing * 0.16)));
      var directionChipY = (y1 + y2) / 2;

      var g = createSvgElement('g', {
        class: 'network-comparator direction-' + comp.dir.toLowerCase(),
        id: 'comparator-' + comp.stepIndex
      });

      var line = createSvgElement('line', {
        class: 'network-comparator-line',
        x1: stageCenter,
        y1: y1,
        x2: stageCenter,
        y2: y2
      });
      g.appendChild(line);

      var directionChip = createSvgElement('rect', {
        class: 'network-comparator-direction-bg',
        x: directionChipX - 8,
        y: directionChipY - 8,
        width: 16,
        height: 16,
        rx: 8,
        ry: 8
      });
      g.appendChild(directionChip);

      var directionPath = comp.directionMarker === 'up' ?
        'M ' + directionChipX + ' ' + (directionChipY + 4) +
        ' L ' + directionChipX + ' ' + (directionChipY - 3) +
        ' M ' + (directionChipX - 3) + ' ' + directionChipY +
        ' L ' + directionChipX + ' ' + (directionChipY - 3) +
        ' L ' + (directionChipX + 3) + ' ' + directionChipY :
        'M ' + directionChipX + ' ' + (directionChipY - 4) +
        ' L ' + directionChipX + ' ' + (directionChipY + 3) +
        ' M ' + (directionChipX - 3) + ' ' + directionChipY +
        ' L ' + directionChipX + ' ' + (directionChipY + 3) +
        ' L ' + (directionChipX + 3) + ' ' + directionChipY;

      var directionGlyph = createSvgElement('path', {
        class: 'network-comparator-direction-glyph',
        d: directionPath,
        'aria-label': comp.directionLabel
      });
      g.appendChild(directionGlyph);

      var pulse1 = createSvgElement('circle', {
        class: 'network-comparator-pulse',
        cx: stageCenter,
        cy: y1,
        r: 4
      });
      g.appendChild(pulse1);

      var circle1 = createSvgElement('circle', {
        class: 'network-comparator-node',
        cx: stageCenter,
        cy: y1,
        r: 4
      });
      g.appendChild(circle1);

      var pulse2 = createSvgElement('circle', {
        class: 'network-comparator-pulse',
        cx: stageCenter,
        cy: y2,
        r: 4
      });
      g.appendChild(pulse2);

      var circle2 = createSvgElement('circle', {
        class: 'network-comparator-node',
        cx: stageCenter,
        cy: y2,
        r: 4
      });
      g.appendChild(circle2);

      svg.appendChild(g);
    });

    xOffset += stageSpacing;
  });

  clearNetworkVisual();
  networkVisual.appendChild(svg);
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
  var networkVisual = getNetworkVisualEl();
  if (networkVisual) {
    networkVisual.innerHTML = '';
  }
}

function showNetworkPlaceholder() {
  var networkVisual = getNetworkVisualEl();
  if (!networkVisual) {
    return;
  }

  clearNetworkVisual();
  var placeholder = document.createElement('div');
  placeholder.className = 'placeholder-box';
  placeholder.textContent = 'Load a valid power-of-two list to generate the comparator network and inspect each pass.';
  networkVisual.appendChild(placeholder);
}

function renderHistory() {
  var historyBody = getHistoryBodyEl();
  if (!historyBody) return;
  historyBody.innerHTML = '';
  if (appState.steps.length === 0) {
    var row = document.createElement('tr');
    row.innerHTML = '<td colspan="6" class="cell-muted">No comparator passes yet. Build steps to populate the trace.</td>';
    historyBody.appendChild(row);
    return;
  }
  var traceComplete = isTraceComplete();
  appState.steps.forEach(function(step, index) {
    var row = document.createElement('tr');
    var comparedValues = step.comparedValues;
    var resultLabel = step.resultLabel;
    var resultClass = step.swapped ? 'swap-yes' : 'swap-no';
    var directionClass = step.dir === 'ASC' ? 'trace-direction-asc' : 'trace-direction-desc';
    var rowStateClass = 'history-row-upcoming';

    if (!traceComplete && index === appState.currentStepIndex) {
      rowStateClass = 'history-row-current';
    } else if ((traceComplete && index <= appState.currentStepIndex) || (!traceComplete && index < appState.currentStepIndex)) {
      rowStateClass = 'history-row-completed';
    }

    row.className = rowStateClass;
    row.innerHTML =
      '<td data-label="Step" class="history-cell-step">' + (index + 1) + '</td>' +
      '<td data-label="Indices" class="history-cell-indices">(' + step.i + ', ' + step.j + ')</td>' +
      '<td data-label="Values" class="history-cell-values">' + comparedValues + '</td>' +
      '<td data-label="Direction" class="history-cell-direction"><span class="trace-direction-pill ' + directionClass + '">' + step.dir + '</span></td>' +
      '<td data-label="Action" class="history-cell-action"><div class="trace-action-stack"><span class="trace-stage-pill">' + step.passLabel + '</span><span class="trace-action-copy">' + step.actionLabel + '</span></div></td>' +
      '<td data-label="Result" class="history-cell-result"><span class="result-pill ' + resultClass + '">' + resultLabel + '</span></td>';
    historyBody.appendChild(row);
  });
}

function updateComparatorStates() {
  var comparators = document.querySelectorAll('.network-comparator');
  comparators.forEach(function(comp) {
    comp.classList.remove('active', 'completed');
  });

  var currentStep = getCurrentStep();
  var traceComplete = isTraceComplete();

  if (currentStep && !traceComplete) {
    var step = currentStep;
    var compId = 'comparator-' + step.index;
    var comp = document.getElementById(compId);
    if (comp) {
      comp.classList.add('active');
    }
  }

  var completedUntil = traceComplete ? appState.currentStepIndex : appState.currentStepIndex - 1;
  for (var i = 0; i <= completedUntil; i++) {
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
    if (preset === 'worst' && appState.isLoaded) {
      handleBuildSteps();
    }
  }
}

function handleBuildSteps() {
  if (!appState.isLoaded) return;
  clearPlaybackTimer();
  appState.steps = generateSteps(appState.numbersLoaded);
  appState.workingNumbers = appState.numbersLoaded.slice();
  appState.currentStepIndex = -1;
  appState.processedCount = 0;
  appState.isBuilt = true;
  appState.currentActionText = getBuildSummaryText();
  updateProcessedCount(0);
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

function handleStepBack() {
  if (!appState.isBuilt || appState.currentStepIndex < 0) return;

  clearPlaybackTimer();
  appState.currentStepIndex--;

  if (appState.currentStepIndex >= 0) {
    var step = appState.steps[appState.currentStepIndex];
    appState.workingNumbers = step.afterValues.slice();
    appState.processedCount = appState.currentStepIndex + 1;
    appState.currentActionText = step.actionText;
    updateStatus('Stepping');
  } else {
    appState.workingNumbers = appState.numbersLoaded.slice();
    appState.processedCount = 0;
    appState.currentActionText = getBuildSummaryText();
    updateStatus('Built');
  }

  updateActionText();
  updateProcessedCount(appState.processedCount);
  updateProgress();
  renderNetwork();
  renderHistory();
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

function handleRestartRun() {
  if (!appState.isBuilt) {
    return;
  }

  clearPlaybackTimer();
  appState.workingNumbers = appState.numbersLoaded.slice();
  appState.currentStepIndex = -1;
  appState.processedCount = 0;
  appState.currentActionText = getBuildSummaryText();
  updateStatus('Built');
  updateProcessedCount(0);
  updateActionText();
  updateProgress();
  renderNetwork();
  renderHistory();
  setButtonStates();
}

function handleClearInput() {
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
  updateValidationMessage(DEFAULT_INPUT_HELP);
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
  dom.sizeSelect = document.getElementById('input-size-select');
  dom.sizeDropdown = document.getElementById('size-dropdown');
  dom.sizeDropdownButton = document.getElementById('size-dropdown-button');
  dom.sizeDropdownValue = document.getElementById('size-dropdown-value');
  dom.sizeDropdownList = document.getElementById('size-dropdown-list');
  dom.sizeDropdownOptions = document.querySelectorAll('[data-size-option]');
  dom.speedRange = document.getElementById('speed-range');
  dom.buildStepsBtn = document.getElementById('build-steps-btn');
  dom.clearInputBtn = document.getElementById('clear-input-btn');
  dom.restartRunBtn = document.getElementById('restart-run-btn');
  dom.stepBackBtn = document.getElementById('step-back-btn');
  dom.stepBtn = document.getElementById('step-btn');
  dom.playBtn = document.getElementById('play-btn');
  dom.pauseBtn = document.getElementById('pause-btn');
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
  if (dom.sizeSelect) {
    dom.sizeSelect.value = String(appState.selectedSize);
  }
  syncSizeDropdownUI();
  setSizeDropdownOpen(false);

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

  if (dom.sizeSelect) {
    dom.sizeSelect.addEventListener('change', handleSizeChange);
  }

  if (dom.sizeDropdownButton) {
    dom.sizeDropdownButton.addEventListener('click', function() {
      var isOpen = dom.sizeDropdownButton.getAttribute('aria-expanded') === 'true';
      setSizeDropdownOpen(!isOpen);
    });
  }

  dom.sizeDropdownOptions.forEach(function(option) {
    option.addEventListener('click', function() {
      handleSizeOptionSelect(option.getAttribute('data-size-option'));
    });
  });

  document.addEventListener('click', function(event) {
    if (dom.sizeDropdown && !dom.sizeDropdown.contains(event.target)) {
      setSizeDropdownOpen(false);
    }
  });

  document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
      setSizeDropdownOpen(false);
    }
  });

  if (dom.buildStepsBtn) {
    dom.buildStepsBtn.addEventListener('click', handleBuildSteps);
  }

  if (dom.clearInputBtn) {
    dom.clearInputBtn.addEventListener('click', handleClearInput);
  }

  if (dom.restartRunBtn) {
    dom.restartRunBtn.addEventListener('click', handleRestartRun);
  }

  if (dom.stepBackBtn) {
    dom.stepBackBtn.addEventListener('click', handleStepBack);
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

});
