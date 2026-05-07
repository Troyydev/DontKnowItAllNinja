import random
import json
import time
import os
from contextlib import nullcontext
try:
    from flask import Flask, request, jsonify
except:
    os.system("pip install Flask")
    from flask import Flask, request, jsonify
try:
    from flask_cors import CORS
except:
    os.system("pip install flask-cors")
    from flask_cors import CORS
try:
    import requests
except:
    os.system("pip install requests")
    import requests


app = Flask(__name__)
CORS(app)
debug_mode = False

# MUST PUT DIS HERE get it from network reqs
cookie = ""

#dist time across for admin anaylsis
def distribute_time(total_time, n):
    cuts = sorted(random.sample(range(1, total_time), n - 1))
    times = [b - a for a, b in zip([0] + cuts, cuts + [total_time])]
    return times

#validate the keys
def ensure_keys(data, keys, default_factory):
    for k in keys:
        data.setdefault(k, default_factory())
    return data

#maps the index
def to_index_map(options_count, active_indexes):
    return {str(i): int(i in active_indexes) for i in range(options_count)}

@app.route("/senddata", methods=["POST"])
def send_data_func():

    raw_data = request.get_data()
    raw_text = raw_data.decode('utf-8', errors='replace')

    if debug_mode: print("RAW:", raw_text)

    #playoad to get the config.quest,url and cookie for auth
    payload = json.loads(raw_text)

    config = payload.get("config", {})
    questions = payload.get("questions", [])
    url = payload.get("url")
    headers = {
        "cookie": cookie,
        "origin": "https://www.knowitallninja.com",
        "referer": str(url)
    }
    if debug_mode: print(url)
    # construct form data to get questions
    form_data = {
        "action": "wp_pro_quiz_admin_ajax_load_data",
        "func": "quizLoadData",

        "quiz": str(config.get("quiz")),
        "quiz_nonce": config.get("quiz_nonce"),
        "course_id": str(config.get("course_id")),

        "data[quiz_nonce]": config.get("quiz_nonce"),
        "data[quiz]": str(config.get("quiz")),
        "data[quizId]": str(config.get("quizId"))
    }
    if debug_mode: print("FORM DATA:", form_data)
    #this is the req to load answers dumb ahh stuck them in a plain array
    req = requests.post("https://www.knowitallninja.com/wp-admin/admin-ajax.php", data=form_data, headers=headers)
    if debug_mode: print(repr(req.text))
    if debug_mode: print(req.status_code)

    if not req.text.strip():
        print("Empty load response")
        return jsonify({"status": "error", "message": "Failed to load quiz data"})

    try:
        data = json.loads(req.text)
    except Exception as e:
        print("Invalid JSON for load", e)
        return jsonify({"status": "error", "message": "Invalid quiz data"})

    quiz_data = data.get("json", {})

    # Now build responses dynamically using quiz_data
    responses = {}

    for qid, qdata in quiz_data.items():
        qid_str = str(qid)
        post_id = qdata.get("question_post_id", 0)  # Fallback if needed (shouldn't be needed tbh)
        correct_mask = qdata.get("points", [])  # From quiz_data get pointers
        options_count = len(correct_mask) if correct_mask else 4  # Assume 4 if missing cuz this is default standered

        # map responses correct
        response_map = {str(i): (correct_mask[i] == 1) for i in range(options_count)}

        responses[qid_str] = {
            "response": response_map,
            "question_pro_id": int(qid),
            "question_post_id": post_id
        }

    # this will validate answers to double check its correct
    form_data_check = {
        "action": "ld_adv_quiz_pro_ajax",
        "func": "checkAnswers",

        "quiz": str(config.get("quiz")),
        "quiz_nonce": config.get("quiz_nonce"),
        "course_id": str(config.get("course_id")),

        "data[quiz_nonce]": config.get("quiz_nonce"),
        "data[course_id]": str(config.get("course_id")),
        "data[quiz]": str(config.get("quiz")),
        "data[quizId]": str(config.get("quizId")),

        "data[responses]": json.dumps(responses)
    }
    #check answr responds with all correct answers
    req_check = requests.post(
        "https://www.knowitallninja.com/wp-admin/admin-ajax.php",
        data=form_data_check,
        headers=headers
    )

    if debug_mode: print("CHECK RAW:", repr(req_check.text))
    if debug_mode: print(req_check.status_code)

    if not req_check.text.strip():
        print("Empty check response")
        check_data = {}
    else:
        try:
            check_data = json.loads(req_check.text)
        except Exception as e:
            print("Invalid JSON for check", e)
            check_data = {}

    #Build the final pointer and correctly etc etc
    pointst = 0
    correctques = 0
    completion_responses = {}

    for qid_str, qdata in quiz_data.items():
        # primary source for mask
        correct_mask = qdata.get("points", [])

        if not correct_mask:
            print(f"{qid_str} -> missing mask")
            continue

        # fallback from check
        check_entry = check_data.get(qid_str, {})
        fallback_mask = check_entry.get("e", {}).get("c", [])

        # use primary if available, else fallback
        if not correct_mask:
            correct_mask = fallback_mask

        # detect correctness (should be True since its selected correctly)
        is_correct = check_entry.get("c", False)

        # possible_points dis for multi and single pointers
        possible_points = sum(1 for v in correct_mask if v == 1) if correct_mask else 1

        pointst += possible_points
        correctques += possible_points if is_correct else 0
        #validated reponse (nonce validation did nothing lmao)
        completion_responses[qid_str] = {
            "time": random.randint(1, 20),
            "points": possible_points,
            "correct": 1 if is_correct else 0,
            "p_nonce": check_entry.get("p_nonce"),
            "a_nonce": check_entry.get("a_nonce"),
            "data": {str(i): int(correct_mask[i]) for i in range(len(correct_mask))},
            "possiblePoints": possible_points,
        }

    total_questions = len(completion_responses)

    correct_questions = sum(
        1 for r in completion_responses.values() if r.get("correct") == 1
    )

    quiz_time = sum(
        r.get("time", 0) for r in completion_responses.values()
    )
    now = int(time.time() * 1000)

    result_percent = round(
        (correctques / pointst) * 100, 2
    ) if pointst else 0

    #cat might be a fault point as i didnt get how to use it.
    completion_responses["comp"] = {
        "points": pointst,
        "correctQuestions": correctques,
        "quizTime": quiz_time,
        "result": result_percent,
        "quizEndTimestamp": now,
        "quizStartTimestamp": now - (quiz_time * 1000),
        "cats": {
            "0": result_percent
        }
    }
    #build final form data
    form_data_corrected = {
        "action": "wp_pro_quiz_completed_quiz",
        "course_id": str(config.get("course_id")),
        "lesson_id": str(config.get("lesson_id")),
        "topic_id": str(config.get("topic_id")),
        "quiz": str(config.get("quiz")),
        "quizId": str(config.get("quizId")),
        "results": json.dumps(completion_responses),
        "timespent": int(random.randint(34, 190)),
        "quiz_nonce": config.get("quiz_nonce"),
    }
    if debug_mode: print(form_data_corrected)

    # tiny rate limit pause
    time.sleep(1)
    #the final vaildate answer req
    req_correct = requests.post("https://www.knowitallninja.com/wp-admin/admin-ajax.php", data=form_data_corrected, headers=headers)

    if debug_mode: print(repr(req_correct.text))
    if debug_mode: print(req_correct.status_code)

    time.sleep(1)
    #emu the next button to be able to confirm it!!!!
    req_final = requests.post(f"{str(url)}?quiz_redirect=1&quiz_id={str(config.get('quizId'))}", headers=headers)
    return jsonify({
        "status": "ok",
        "form_data": form_data
    })#



if __name__ == "__main__":
    app.run(host="127.0.0.1",port=1234)
