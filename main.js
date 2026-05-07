const URL = "https://www.knowitallninja.com/wp-admin/admin-ajax.php"; // Direct target api

(async () => {

    console.log("%cKnowItAllNinja Auto-Complete Started!! 🟪", "color:#c026d3;font-weight:bold");

    let config = null;

    let questionsMeta = [];

    // get config

    try {

        const scriptText = [...document.querySelectorAll("script")]

            .map(s => s.textContent)

            .find(t => t && t.includes("wpProQuizFront"));

        if (!scriptText) throw new Error("wpProQuizFront script not found");

        const match = scriptText.match(/wpProQuizFront\((\{[\s\S]*?\})\)/);

        if (!match) throw new Error("Config object not found");

        const jsonLike = match[1]

            .replace(/(\w+):/g, '"$1":')

            .replace(/'/g, '"');

        config = JSON.parse(jsonLike);

        console.log("[+] Config extracted:", config);

    } catch (e) {

        console.error("[-] Config extraction failed:", e.message);

        return;

    }

    // get question meta data

    try {

        const items = [...document.querySelectorAll("li.wpProQuiz_listItem")];

        questionsMeta = items.map(q => {

            const metaRaw = q.getAttribute("data-question-meta");

            const meta = metaRaw ? JSON.parse(metaRaw) : {};

            const list = q.querySelector(".wpProQuiz_questionList");

            return {

                question_pro_id: meta.question_pro_id,

                question_post_id: meta.question_post_id,

                question_id: list?.getAttribute("data-question_id") || null,

                options_count: q.querySelectorAll(".wpProQuiz_questionListItem").length

            };

        });

        console.log(`[+] ${questionsMeta.length} questions parsed`);

    } catch (e) {

        console.error("[-] Question parsing failed:", e.message);

        return;

    }

    const cookie = document.cookie;

    const headers = {

        "Content-Type": "application/x-www-form-urlencoded",

        "Cookie": cookie,

        "Origin": "https://www.knowitallninja.com",

        "Referer": window.location.href

    };

    // load question keys

    console.log("[→] Loading quiz data (answer keys)...");

    const loadForm = new URLSearchParams({

        action: "wp_pro_quiz_admin_ajax_load_data",

        func: "quizLoadData",

        quiz: config.quiz,

        quiz_nonce: config.quiz_nonce,

        course_id: config.course_id || "",

        "data[quiz_nonce]": config.quiz_nonce,

        "data[quiz]": config.quiz,

        "data[quizId]": config.quizId

    });

    let quizData = {};

    try {

        const loadRes = await fetch(URL, { method: "POST", headers, body: loadForm });

        const loadText = await loadRes.text();

        const loadJson = JSON.parse(loadText);

        quizData = loadJson.json || {};

        console.log(`[+] Loaded ${Object.keys(quizData).length} question answer masks`);

    } catch (e) {

        console.error("[-] Failed to load quiz data:", e.message);

        return;

    }

    // get the req response

    const responses = {};

    for (const [qid, qdata] of Object.entries(quizData)) {

        const qidStr = String(qid);

        const correctMask = qdata.points || Array(questionsMeta.find(m => m.question_pro_id == qid)?.options_count || 4).fill(0);

        const responseMap = {};

        correctMask.forEach((val, i) => {

            responseMap[i] = val === 1;

        });

        responses[qidStr] = {

            response: responseMap,

            question_pro_id: parseInt(qid),

            question_post_id: qdata.question_post_id || 0

        };

    }

    // validate frst set

    console.log("[→] Submitting answer check...");

    const checkForm = new URLSearchParams({

        action: "ld_adv_quiz_pro_ajax",

        func: "checkAnswers",

        quiz: config.quiz,

        quiz_nonce: config.quiz_nonce,

        course_id: config.course_id || "",

        "data[quiz_nonce]": config.quiz_nonce,

        "data[course_id]": config.course_id || "",

        "data[quiz]": config.quiz,

        "data[quizId]": config.quizId,

        "data[responses]": JSON.stringify(responses)

    });

    let checkData = {};

    try {

        const checkRes = await fetch(URL, { method: "POST", headers, body: checkForm });

        const checkText = await checkRes.text();

        checkData = JSON.parse(checkText);

        console.log("[+] Answer check completed");

    } catch (e) {

        console.warn("[!] CheckAnswers failed (non-critical):", e.message);

    }

    // payload

    let pointst = 0;

    let correctques = 0;

    const completion_responses = {};

    for (const [qidStr, qdata] of Object.entries(quizData)) {

        const correctMask = qdata.points || [];

        const checkEntry = checkData[qidStr] || {};

        const possiblePoints = correctMask.reduce((sum, v) => sum + (v === 1 ? 1 : 0), 0) || 1;

        pointst += possiblePoints;

        correctques += possiblePoints; // We are always correct

        completion_responses[qidStr] = {

            time: Math.floor(Math.random() * 18) + 3,

            points: possiblePoints,

            correct: 1,

            p_nonce: checkEntry.p_nonce || "",

            a_nonce: checkEntry.a_nonce || "",

            data: Object.fromEntries(correctMask.map((v, i) => [i, v])),

            possiblePoints: possiblePoints

        };

    }

    const totalTime = Math.floor(Math.random() * 140) + 65;

    const now = Date.now();

    completion_responses.comp = {

        points: pointst,

        correctQuestions: correctques,

        quizTime: totalTime,

        result: 100,

        quizEndTimestamp: now,

        quizStartTimestamp: now - (totalTime * 1000),

        cats: { "0": 100 }

    };

    // final submission

    console.log("[→] Submitting final completion (100%)...");

    const completeForm = new URLSearchParams({

        action: "wp_pro_quiz_completed_quiz",

        course_id: config.course_id || "",

        lesson_id: config.lesson_id || "",

        topic_id: config.topic_id || "",

        quiz: config.quiz,

        quizId: config.quizId,

        results: JSON.stringify(completion_responses),

        timespent: totalTime,

        quiz_nonce: config.quiz_nonce

    });

    try {

        const finalRes = await fetch(URL, { method: "POST", headers, body: completeForm });

        const finalText = await finalRes.text();

        console.log("[+] Completion submitted:", finalText.substring(0, 300));

        // Final redirect simulation

        await fetch(`${window.location.origin}${window.location.pathname}?quiz_redirect=1&quiz_id=${config.quizId}`, {

            method: "POST",

            headers: { "Cookie": cookie }

        });

        console.log("%cQuiz completed with 100% 🟪", "color:#22c55e;font-size:14px;font-weight:bold");

    } catch (e) {

        console.error("[-] Final submission failed:", e.message);

    }

})();
