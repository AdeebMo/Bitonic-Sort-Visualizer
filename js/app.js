/* app.js
   Minimal bootstrap for the Bitonic Sorting Network teaching tool.
   This file will initialize the app structure and connect the future control logic.
*/

document.addEventListener('DOMContentLoaded', function () {
  var statusText = document.getElementById('status-value');
  if (statusText) {
    statusText.textContent = 'idle';
  }
});
