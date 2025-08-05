import os
import json
import requests
import google.generativeai as genai  # Added for Gemini
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from data_loader import load_aptitude, load_coding
from utils.feedback import generate_aptitude_feedback

load_dotenv()

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_PATH = os.path.join(os.path.dirname(__file__), "../data")
PROFILE_PATH = os.path.join(os.path.dirname(__file__), "user_profiles.json")
USERS_PATH = os.path.join(os.path.dirname(__file__), "users.json")
JUDGE0_KEY = os.getenv("JUDGE0_KEY")
JUDGE0_URL = os.getenv("JUDGE0_URL", "https://judge0-ce.p.rapidapi.com")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")  # Added for Gemini

def load_profiles():
    if not os.path.exists(PROFILE_PATH):
        with open(PROFILE_PATH, "w") as f:
            json.dump({}, f)
    with open(PROFILE_PATH, "r") as f:
        return json.load(f)

def save_profiles(data):
    with open(PROFILE_PATH, "w") as f:
        json.dump(data, f, indent=2)

def get_questions(test_type, company, level):
    if test_type == "aptitude":
        return load_aptitude(company, level)
    elif test_type == "coding":
        return load_coding(company, level)
    return []

class AptitudeRequest(BaseModel):
    company: str
    level: str

class AptitudeSubmitRequest(BaseModel):
    username: str
    company: str
    level: str
    answers: list
    questions: list

class CodingRequest(BaseModel):
    company: str
    level: str

class CodingSubmitRequest(BaseModel):
    username: str
    company: str
    level: str
    answers: list # List of dicts: {code, language_id, question_index} or {answer, question_index}

@app.post("/api/aptitude")
def get_aptitude(req: AptitudeRequest):
    questions = load_aptitude(req.company, req.level)
    return questions

@app.post("/api/aptitude/submit")
def submit_aptitude(data: AptitudeSubmitRequest):
    print("DATA RECEIVED:", data)
    score = 0
    total = len(data.questions) if data.questions else 0
    if not data.questions or not data.answers:
        ai_report = {}
        feedback = (
            "**Your Aptitude Test Results**\n"
            f"Score: {score}/{total}\n"
            "No questions attempted."
        )
    else:
        for q, a in zip(data.questions, data.answers):
            if isinstance(q, dict) and 'answer' in q and a == q['answer']:
                score += 1
        wrongs = [i+1 for i, (q, a) in enumerate(zip(data.questions, data.answers)) if q.get("answer") != a]
        ai_report = generate_aptitude_feedback(data.answers, data.questions)

        # Build professional feedback
        feedback_lines = []
        feedback_lines.append("**Your Aptitude Test Results**")
        feedback_lines.append(f"Score: {score}/{total}")

        if score == total:
            feedback_lines.append("Outstanding performance! You answered all questions correctly. Keep up the excellent work.")
        elif score == 0:
            feedback_lines.append("We recommend revisiting all sections, as none of the answers were correct. Consider practicing foundational concepts.")
        else:
            feedback_lines.append(f"You answered {score} out of {total} correctly.")
            if wrongs:
                feedback_lines.append(f"Questions to review: {', '.join(map(str, wrongs))}")

        if ai_report:
            # Section-wise performance
            if ai_report.get("section_scores"):
                section_details = ", ".join([f"{sec.capitalize()}: {val}%" for sec, val in ai_report["section_scores"].items()])
                feedback_lines.append(f"**Section Performance:** {section_details}")

            # Strengths and weaknesses
            if ai_report.get("weak_sections"):
                weak_str = ", ".join([sec.capitalize() for sec in ai_report["weak_sections"]])
                feedback_lines.append(f"**Areas to Improve:** {weak_str}")
            if ai_report.get("recommendations"):
                feedback_lines.append("**Recommendations:**")
                for rec in ai_report["recommendations"]:
                    feedback_lines.append(f"- {rec}")

            if ai_report.get("summary"):
                feedback_lines.append(f"*{ai_report['summary']}*")
        else:
            feedback_lines.append("No detailed section feedback available.")

        feedback = "\n".join(feedback_lines)

    profiles = load_profiles()
    user_profile = profiles.get(data.username, {})
    if "tests" not in user_profile or not isinstance(user_profile["tests"], list):
        user_profile["tests"] = []
    user_profile["tests"].insert(0, {
        "company": data.company,
        "type": "aptitude",
        "level": data.level,
        "score": score,
        "total": total,
        "feedback": feedback
    })
    profiles[data.username] = user_profile
    save_profiles(profiles)
    return {"score": score, "total": total, "feedback": feedback, "ai_report": ai_report}

@app.post("/api/coding")
def get_coding(req: CodingRequest):
    questions = load_coding(req.company, req.level)
    return questions

# Gemini-powered code review function (replaces openai_code_review)
def gemini_code_review(code, question_text, model="gemini-1.5-flash-latest"):
    if not GEMINI_API_KEY:
        return "AI review unavailable (Gemini API key not set)."
    try:
        genai.configure(api_key=GEMINI_API_KEY)
        gemini_model = genai.GenerativeModel(model)
        prompt = (
            "You are an expert coding interviewer. "
            "Review the following code written to solve this problem:\n\n"
            f"Problem: {question_text}\n\n"
            f"Candidate's Code:\n{code}\n\n"
            "Give concise, actionable feedback about code quality, correctness, readability, and possible improvements. "
            "Point out any edge cases missed or possible optimizations. If the code is good, say so!"
        )
        response = gemini_model.generate_content(prompt)
        return response.text.strip()
    except Exception as e:
        return f"AI review unavailable: {e}"

@app.post("/api/coding/submit")
def submit_coding(data: CodingSubmitRequest):
    profiles = load_profiles()
    user_profile = profiles.get(data.username, {})
    if "tests" not in user_profile or not isinstance(user_profile["tests"], list):
        user_profile["tests"] = []

    feedbacks = []
    questions = load_coding(data.company, data.level)
    for ans in data.answers:
        idx = ans.get("question_index") if isinstance(ans, dict) else None
        if idx is None or idx >= len(questions):
            continue
        q = questions[idx]
        if 'code' in ans and 'language_id' in ans:
            code = ans["code"]
            ai_review = gemini_code_review(code, q.get("description", q.get("title", "")))
            feedbacks.append(
                f"""### 💡 Q{idx+1}: AI Review  
{ai_review}
"""
            )
        else:
            feedbacks.append(f"Q{idx+1}: Unknown question type.")

    overall_feedback = (
        f"# 🎉 Test Complete!\n"
        f"**Your Submissions:** `{len(feedbacks)}`\n\n"
        "## AI Feedback\n"
        f"{''.join(feedbacks)}"
    )
    if not feedbacks:
        overall_feedback += "\n\n*No coding questions were submitted for review.*"

    user_profile["tests"].insert(0, {
        "company": data.company,
        "type": "coding",
        "level": data.level,
        "score": len(feedbacks),
        "total": len(feedbacks),
        "feedback": overall_feedback
    })
    profiles[data.username] = user_profile
    save_profiles(profiles)
    return {"score": len(feedbacks), "total": len(feedbacks), "feedback": overall_feedback}
    
@app.get("/api/profile")
def get_profile(username: str):
    profiles = load_profiles()
    return profiles.get(username, {"tests": []})

@app.get("/api/companies")
def get_companies():
    files = os.listdir(os.path.join(DATA_PATH, "aptitude"))
    return [f.replace(".json", "").capitalize() for f in files]