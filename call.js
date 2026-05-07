const URL = "http://127.0.0.1:1234/senddata";



let QuestionsInfo2 = null;
let ServerInfo2 = null;



(async () => {



  // -----------------------------
  // 1. Extract questions + counts
  // -----------------------------
  try {



    const questions = [...document.querySelectorAll("li.wpProQuiz_listItem")];



    ServerInfo2 = questions.map(q => {



      const metaRaw = q.getAttribute("data-question-meta");
      const meta = metaRaw ? JSON.parse(metaRaw) : {};



      const list = q.querySelector(".wpProQuiz_questionList");



      return {
        question_pro_id: meta.question_pro_id,
        question_post_id: meta.question_post_id,
        question_id: list?.getAttribute("data-question_id") || null,



        // NEW: number of answer options
        options_count: q.querySelectorAll(".wpProQuiz_questionListItem").length
      };
    });



    const totalQuestions = ServerInfo2.length;



    console.log("Questions:", ServerInfo2);
    console.log("Total questions:", totalQuestions);



  } catch (error) {
    console.error("Question parse error:", error.message);
    return;
  }





  // -----------------------------
  // 2. Extract quiz config
  // -----------------------------
  try {



    const scriptText = [...document.querySelectorAll("script")]
      .map(s => s.textContent)
      .find(t => t && t.includes("wpProQuizFront"));



    if (!scriptText) throw new Error("wpProQuizFront not found");



    const match = scriptText.match(/wpProQuizFront\((\{[\s\S]*?\})\)/);



    if (!match) throw new Error("Config not found");



    const jsonLike = match[1]
      .replace(/(\w+):/g, '"$1":')
      .replace(/'/g, '"');



    QuestionsInfo2 = JSON.parse(jsonLike);



    console.log("Config:", QuestionsInfo2);



  } catch (error) {
    console.error("Config parse error:", error.message);
    return;
  }





  // -----------------------------
  // 3. Send BOTH to server
  // -----------------------------
  try {



    const response = await fetch(URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        config: QuestionsInfo2,
        questions: ServerInfo2,
        total_questions: ServerInfo2.length
      })
    });



    if (!response.ok) {
      throw new Error(`Response status: ${response.status}`);
    }



    const json = await response.json();
    console.log("Server response:", json);



  } catch (error) {
    console.error("Fetch error:", error.message);
  }



})();

