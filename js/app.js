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

function getCurrentStep() {
  if (appState.currentStepIndex < 0 || appState.currentStepIndex >= appState.steps.length) {
    return null;
  }
  return appState.steps[appState.currentStepIndex];
}

function getValuePillWidth(values) {
  var maxChars = 1;
  for (var i = 0; i < values.length; i++) {
    maxChars = Math.max(maxChars, String(values[i]).length);
  }
  return Math.max(64, maxChars * 11 + 28);
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
  var wireSpacing = Math.max(34, Math.min(48, Math.floor(560 / appState.inputSize)));
  var stageSpacing = stages.length > 10 ? 86 : stages.length > 7 ? 94 : 104;
  var leftRail = 84;
  var stageStartX = leftRail;
  var valuePillWidth = getValuePillWidth(values);
  var stageAreaEndX = stageStartX + stages.length * stageSpacing;
  var wireEndX = stageAreaEndX - 18;
  var valueStartX = stageAreaEndX + 22;
  var totalWidth = valueStartX + valuePillWidth + 22;
  var stageLabelHeight = 62;
  var totalHeight = stageLabelHeight + appState.inputSize * wireSpacing + 26;
  var svg = createSvgElement('svg', {
    class: 'network-svg',
    width: totalWidth,
    height: totalHeight
  });

  svg.setAttribute('viewBox', '0 0 ' + totalWidth + ' ' + totalHeight);

  // Draw row backgrounds, horizontal wires, labels, and values
  for (var i = 0; i < appState.inputSize; i++) {
    var y = stageLabelHeight + i * wireSpacing + wireSpacing / 2;
    var isCompared = currentStep && (currentStep.i === i || currentStep.j === i);
    var rowBand = createSvgElement('rect', {
      class: 'network-row-band' + (i % 2 === 0 ? '' : ' is-odd'),
      x: stageStartX - 10,
      y: y - (wireSpacing / 2) + 6,
      width: wireEndX - stageStartX + 20,
      height: wireSpacing - 12,
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
      y: y + 4,
      textContent: i
    });
    labelGroup.appendChild(text);
    svg.appendChild(labelGroup);

    var valueGroup = createSvgElement('g', { class: 'network-value-pill' });
    var valueRect = createSvgElement('rect', {
      class: 'network-value-pill-bg' + (isCompared ? ' compared' : ''),
      id: 'value-pill-bg-' + i,
      x: valueStartX,
      y: y - 16,
      width: valuePillWidth,
      height: 32,
      rx: 16,
      ry: 16
    });
    valueGroup.appendChild(valueRect);

    var valueText = createSvgElement('text', {
      class: 'network-value-pill-text' + (isCompared ? ' compared' : ''),
      id: 'value-text-' + i,
      x: valueStartX + valuePillWidth / 2,
      y: y + 4,
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
    if (currentStep) {
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
      height: totalHeight - 16,
      rx: 20,
      ry: 20
    });
    svg.appendChild(rect);

    var text = createSvgElement('text', {
      class: 'network-stage-label',
      x: stageCenter,
      y: 26,
      textContent: stage.label
    });
    svg.appendChild(text);

    var meta = createSvgElement('text', {
      class: 'network-stage-meta',
      x: stageCenter,
      y: 42,
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
  appState.steps.forEach(function(step, index) {
    var row = document.createElement('tr');
    var comparedValues = step.comparedValues;
    var actionLabel = step.passLabel + ' - ' + step.actionLabel;
    var resultLabel = step.resultLabel;
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
    historyBody.appendChild(row);
  });
}

function updateComparatorStates() {
  var comparators = document.querySelectorAll('.network-comparator');
  comparators.forEach(function(comp) {
    comp.classList.remove('active', 'completed');
  });

  var currentStep = getCurrentStep();

  if (currentStep) {
    var step = currentStep;
    var compId = 'comparator-' + step.index;
    var comp = document.getElementById(compId);
    if (comp) {
      comp.classList.add('active');
    }
  }

  for (var i = 0; i < appState.currentStepIndex; i++) {
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
  appState.currentActionText = 'Built ' + appState.steps.length + ' comparator steps across ' + generateBitonicNetwork(appState.inputSize).stages.length + ' passes. Step through them or press Play.';
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
