def generate_aptitude_feedback(answers, questions):
    section_correct = {}
    section_total = {}
    for a, q in zip(answers, questions):
        section = q.get('category') or q.get('section')
        if not section:
            continue
        section = section.lower()
        section_total[section] = section_total.get(section, 0) + 1
        if a == q['answer']:
            section_correct[section] = section_correct.get(section, 0) + 1

    section_scores = {}
    for sec in section_total:
        correct = section_correct.get(sec, 0)
        total = section_total[sec]
        percent = (correct / total) * 100 if total else 0
        section_scores[sec] = round(percent)

    weak_sections = [sec for sec, score in section_scores.items() if score < 70]

    tips = {
        "quantitative": "Practice more quantitative aptitude problems.",
        "logical": "Review logical reasoning strategies.",
        "situational": "Work on situational judgment and real-life scenarios.",
        "verbal": "Read and practice more verbal reasoning questions.",
        "puzzle": "Solve more puzzles to improve analytical skills.",
        "english": "Practice English grammar and comprehension.",
    }
    recommendations = []
    for sec in weak_sections:
        if sec in tips:
            recommendations.append(tips[sec])
        else:
            recommendations.append(f"Review and practice more {sec} questions to improve your skills.")

    if section_scores:
        max_score = max(section_scores.values())
        min_score = min(section_scores.values())
        best = [sec.capitalize() for sec, s in section_scores.items() if s == max_score]
        worst = [sec.capitalize() for sec, s in section_scores.items() if s == min_score]
        best_str = ", ".join(best)
        worst_str = ", ".join(worst)
        summary = (
            f"Your strengths: {best_str} ({max_score}%). "
            f"Improve your {worst_str} skills ({min_score}%) for better results."
        )
    else:
        summary = "No sections found."

    return {
        "section_scores": section_scores,
        "weak_sections": weak_sections,
        "recommendations": recommendations,
        "summary": summary
    }