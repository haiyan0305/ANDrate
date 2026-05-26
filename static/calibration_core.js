(() => {
    const configuredThreshold = Number(localStorage.getItem("val_calibThreshold"));
    const PASS_THRESHOLD = Number.isFinite(configuredThreshold) ? Math.max(0, Math.min(100, configuredThreshold)) : 60;
    const MAX_FAILED_ATTEMPTS = 3;
    const POINTS = [[5, 15], [50, 15], [95, 15], [5, 50], [50, 50], [95, 50], [5, 85], [50, 85], [95, 85]];

    let currentPointIdx = 0;
    let clickProgress = 5;
    let gazeDataX = [];
    let gazeDataY = [];
    let isCollecting = false;
    let latestScore = 0;

    const query = new URLSearchParams(window.location.search);
    const target = query.get("target");
    const failedAttempts = Number(query.get("attempt") || "0");
    const isTaskFlow = target === "segmentation" || target === "rating";

    const logText = document.getElementById("log-text");
    const progressFill = document.getElementById("progress-fill");
    const calibDot = document.getElementById("calibration-dot");
    const gazeCursor = document.getElementById("gaze-cursor");
    const resultHint = document.getElementById("result-hint");
    const btnRecalibrate = document.getElementById("btn-recalibrate");
    const btnAccept = document.getElementById("btn-accept");
    const returnBtn = document.getElementById("return-btn");

    function updateLog(msg) {
        logText.innerText = msg;
    }

    function setProgress(msg, percent) {
        document.getElementById("progress-text").innerText = msg;
        progressFill.style.width = percent + "%";
    }

    function startCalibration() {
        currentPointIdx = 0;
        showNextPoint();
    }

    function showNextPoint() {
        if (currentPointIdx >= POINTS.length) {
            finishCalibration();
            return;
        }

        clickProgress = 5;
        const [x, y] = POINTS[currentPointIdx];
        calibDot.style.left = x + "%";
        calibDot.style.top = y + "%";
        calibDot.style.display = "block";
        document.getElementById("click-count").innerText = clickProgress;
        setProgress(`Point ${currentPointIdx + 1}/9: Click the dot 5 times`, (currentPointIdx / 9) * 100);
    }

    function finishCalibration() {
        webgazer.showPredictionPoints(false);
        document.getElementById("modal-ready").style.display = "block";
        updateLog("Calibration points collected. Awaiting validation.");
    }

    function restartCalibration() {
        document.getElementById("modal-result").style.display = "none";
        gazeCursor.style.display = "none";
        resultHint.innerText = "";
        progressFill.style.background = "var(--accent)";
        webgazer.clearCalibration();
        webgazer.showPredictionPoints(true);
        updateLog("Rebooting calibration...");
        setTimeout(startCalibration, 500);
    }

    function goBackHome() {
        window.location.href = "/";
    }

    function continueToTarget() {
        if (isTaskFlow) {
            window.location.href = `/${target}`;
            return;
        }

        document.getElementById("modal-result").style.display = "none";
        returnBtn.style.display = "inline-block";
        progressFill.style.background = "var(--success)";
        updateLog("Calibration accepted.");
    }

    function handleFailedValidation() {
        const nextFailedAttempts = failedAttempts + 1;
        if (nextFailedAttempts >= MAX_FAILED_ATTEMPTS) {
            alert("Calibration failed 3 times (<60%). Returning to setup.");
            goBackHome();
            return;
        }

        alert(`Calibration accuracy ${latestScore}% < ${PASS_THRESHOLD}%. Retrying (${nextFailedAttempts}/${MAX_FAILED_ATTEMPTS})...`);
        window.location.href = `/calibration?target=${encodeURIComponent(target)}&attempt=${nextFailedAttempts}`;
    }

    function showResult() {
        document.getElementById("validation-dot").style.display = "none";
        document.getElementById("validation-timer").style.display = "none";

        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        let totalDist = 0;
        gazeDataX.forEach((x, i) => {
            const d = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(gazeDataY[i] - centerY, 2));
            totalDist += d;
        });

        const avgDist = gazeDataX.length > 0 ? totalDist / gazeDataX.length : Number.MAX_VALUE;
        const score = Math.max(0, Math.min(100, 100 - (avgDist / (window.innerHeight / 2) * 100)));
        latestScore = Math.round(score);

        localStorage.setItem("calibration_accuracy", String(latestScore));

        const valEl = document.getElementById("precision-value");
        valEl.innerText = latestScore + "%";
        valEl.style.color = latestScore >= PASS_THRESHOLD ? "var(--success)" : "var(--dot)";

        if (latestScore >= PASS_THRESHOLD) {
            resultHint.innerText = `Passed (>=${PASS_THRESHOLD}%).`;
            btnAccept.innerText = isTaskFlow ? "Continue to Task" : "Accept & Continue";
            btnRecalibrate.style.display = "none";
        } else {
            resultHint.innerText = `Failed (<${PASS_THRESHOLD}%).`;
            btnAccept.innerText = isTaskFlow ? "Retry Calibration" : "Retry Calibration";
            btnRecalibrate.style.display = "none";
        }

        document.getElementById("modal-result").style.display = "block";
        gazeCursor.style.display = "block";
    }

    async function initGazer() {
        document.getElementById("welcome-box").style.display = "none";
        document.getElementById("top-progress-bar").style.display = "flex";
        updateLog("Initializing WebGazer...");

        webgazer.setRegression("ridge").setTracker("TFFacemesh").begin();

        const checkReady = setInterval(() => {
            if (webgazer.isReady()) {
                clearInterval(checkReady);
                webgazer.showVideoPreview(true).showPredictionPoints(true);
                startCalibration();
            }
        }, 500);

        webgazer.setGazeListener((data) => {
            if (!data) return;
            gazeCursor.style.left = data.x + "px";
            gazeCursor.style.top = data.y + "px";
            if (isCollecting && gazeDataX.length < 50) {
                gazeDataX.push(data.x);
                gazeDataY.push(data.y);
            }
        });
    }

    calibDot.onclick = () => {
        clickProgress -= 1;
        document.getElementById("click-count").innerText = clickProgress;
        if (clickProgress <= 0) {
            calibDot.style.display = "none";
            currentPointIdx += 1;
            setTimeout(showNextPoint, 200);
        }
    };

    document.getElementById("btn-go-validation").onclick = () => {
        document.getElementById("modal-ready").style.display = "none";
        gazeDataX = [];
        gazeDataY = [];
        isCollecting = true;

        document.getElementById("validation-dot").style.display = "block";
        document.getElementById("validation-timer").style.display = "block";
        document.getElementById("validation-timer").innerText = "5";

        let timeLeft = 5;
        const timer = setInterval(() => {
            timeLeft -= 1;
            document.getElementById("validation-timer").innerText = timeLeft;
            if (timeLeft <= 0) {
                clearInterval(timer);
                isCollecting = false;
                showResult();
            }
        }, 1000);
    };

    btnRecalibrate.style.display = "none";

    btnAccept.onclick = () => {
        if (latestScore >= PASS_THRESHOLD) {
            continueToTarget();
        } else if (isTaskFlow) {
            handleFailedValidation();
        } else {
            restartCalibration();
        }
    };

    document.getElementById("start-btn").onclick = initGazer;

    if (isTaskFlow) {
        updateLog(`Task flow: ${target}. Need >=${PASS_THRESHOLD}% to continue.`);
    }
})();
