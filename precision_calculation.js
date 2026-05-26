/*
 * Measures the current eye-tracking precision shown on the calibration page.
 */
function calculatePrecision(past50Array) {
  var windowHeight = window.innerHeight;
  var windowWidth = window.innerWidth;

  // Use the latest 50 gaze points.
  var x50 = past50Array[0];
  var y50 = past50Array[1];

  // The validation target is at the center of the screen.
  var staringPointX = windowWidth / 2;
  var staringPointY = windowHeight / 2;

  var precisionPercentages = new Array(50);
  calculatePrecisionPercentages(precisionPercentages, windowHeight, x50, y50, staringPointX, staringPointY);
  var precision = calculateAverage(precisionPercentages);

  // Show precision as a whole-number percentage.
  return Math.round(precision);
};

/*
 * Converts each gaze point's distance from the center target into a percentage.
 */
function calculatePrecisionPercentages(precisionPercentages, windowHeight, x50, y50, staringPointX, staringPointY) {
  for (x = 0; x < 50; x++) {
    // Distance from the current gaze point to the target.
    var xDiff = staringPointX - x50[x];
    var yDiff = staringPointY - y50[x];
    var distance = Math.sqrt((xDiff * xDiff) + (yDiff * yDiff));

    // Points farther than half the window height count as 0%.
    var halfWindowHeight = windowHeight / 2;
    var precision = 0;
    if (distance <= halfWindowHeight && distance > -1) {
      precision = 100 - (distance / halfWindowHeight * 100);
    } else if (distance > halfWindowHeight) {
      precision = 0;
    } else if (distance > -1) {
      precision = 100;
    }

    // Save the score for averaging.
    precisionPercentages[x] = precision;
  }
}

/*
 * Returns the average precision across the sample window.
 */
function calculateAverage(precisionPercentages) {
  var precision = 0;
  for (x = 0; x < 50; x++) {
    precision += precisionPercentages[x];
  }
  precision = precision / 50;
  return precision;
}
